"""
RunPod Serverless worker: image-to-video (emlak/arsa sahneleri).

Hız için tasarım:
  * Model ağırlıkları RunPod "cached models" önbelleğinden okunur (/runpod-volume/huggingface-cache).
    Endpoint ayarındaki "Model" alanı MODEL_ID ile aynı olmalı. İnternetten indirme yapılmaz,
    bu sayede imaj küçük kalır ve hızlı çekilir.
  * Model, süreç açılırken BİR KEZ GPU'ya yüklenir (modül seviyesi). Sonraki işler sıcak süreçte çalışır.
  * Açılışın her adımı süresiyle loglanır; yavaşlığın nerede olduğu loglarda görünür.
  * Çıktı doğrudan R2'ye yüklenir, panel yalnızca URL alır.

Desteklenen model aileleri (MODEL_FAMILY):
  * hunyuan15 — HunyuanVideo 1.5 i2v (8B, 48 GB GPU'ya sığar). Varsayılan.
  * ltx2      — LTX-2.x i2v (19B, 80 GB GPU).

Input şeması packages/providers/src/runpod.ts içindeki VideoWorkerInput ile aynı tutulmalıdır.
"""

import glob
import os
import tempfile
import time
from io import BytesIO

# Bellek parçalanmasını azaltır; torch import edilmeden önce ayarlanmalı.
os.environ.setdefault("PYTORCH_CUDA_ALLOC_CONF", "expandable_segments:True")

import subprocess

import boto3
import requests
import runpod
import torch
from PIL import Image

MODEL_FAMILY = os.environ.get("MODEL_FAMILY", "hunyuan15")
DEFAULT_MODELS = {
    "hunyuan15": "hunyuanvideo-community/HunyuanVideo-1.5-Diffusers-480p_i2v_step_distilled",
    "ltx2": "Lightricks/LTX-2.5-Diffusers",
    # İnşaat sahnesi: ilk kare (boş arsa) → son kare (bitmiş bina). Lightning = 4 adım, CFG yok.
    "wan22": "magespace/Wan2.2-I2V-A14B-Lightning-Diffusers",
    # İnşaat sahnesinin son karesi: drone karesine bina ekleyen görsel düzenleme.
    "qwen_edit": "Qwen/Qwen-Image-Edit-2511",
}
# Bu aileler video değil görsel üretir; handler PNG döndürür.
IMAGE_FAMILIES = {"qwen_edit"}
MODEL_ID = os.environ.get("MODEL_ID", DEFAULT_MODELS[MODEL_FAMILY])
RUNPOD_HF_CACHE = os.environ.get("RUNPOD_HF_CACHE", "/runpod-volume/huggingface-cache/hub")
# Önbellekte yoksa HF'den indirmeye izin ver (yalnızca geliştirme için; üretimde 0 olmalı).
ALLOW_DOWNLOAD = os.environ.get("ALLOW_DOWNLOAD", "0") == "1"
# auto: 80 GB altı kartlarda bileşenleri (metin kodlayıcı, transformer, VAE) sırayla GPU'ya alır.
# Model RAM'de kalır; diskten/internetten yeniden yükleme yoktur, yalnızca CPU<->GPU taşıması olur.
CPU_OFFLOAD = os.environ.get("CPU_OFFLOAD", "auto")
NUM_STEPS = int(os.environ.get("NUM_STEPS", "8"))
# sage_hub: SageAttention (INT8/FP8 attention, Blackwell sm120 destekli, HF hub'dan hazır kernel).
# native: PyTorch SDPA. İkisinde de Hunyuan'ın dolgu maskesi kaldırılır (bkz. install_maskless_attention).
# Varsayılan native: hub'daki Sage kernel'lerinde Blackwell (sm120) derlemesi yok (2026-10-14).
# sm80/89/90 kartlarda (A100, L40S, H100) ATTENTION_BACKEND=sage_hub verilebilir.
ATTENTION_BACKEND = os.environ.get("ATTENTION_BACKEND", "native")
# diffusers 0.41 sage_hub için kernel v3 ister; v3'te yalnızca torch>=2.12 + CUDA 13 derlemeleri var.
# v2'de torch 2.10/2.11 + CUDA 12.8 derlemesi bulunduğu için imaj torch 2.11-cu128 ve kernel v2 kullanır.
SAGE_KERNEL_VERSION = int(os.environ.get("SAGE_KERNEL_VERSION", "2"))

# Real-ESRGAN (general x4v3, 5 MB) — 480p klibi hedef çözünürlüğe keskin şekilde büyütür.
# Ağırlık build sırasında imaja indirilir (Dockerfile, sha256 doğrulamalı).
UPSCALER_PATH = os.environ.get("UPSCALER_PATH", "/app/models/realesr-general-x4v3.pth")
UPSCALE_BATCH = int(os.environ.get("UPSCALE_BATCH", "8"))

R2_BUCKET = os.environ.get("R2_BUCKET", "")
R2_PUBLIC_BASE_URL = os.environ.get("R2_PUBLIC_BASE_URL", "").rstrip("/")

T_START = time.time()
ATTENTION_IN_USE = "native"
ATTENTION_ERROR = None


def log(msg: str) -> None:
    print(f"[worker +{time.time() - T_START:6.1f}s] {msg}", flush=True)


def resolve_model_path(model_id: str) -> str:
    """RunPod önbelleğindeki snapshot klasörünü bulur: models--{org}--{name}/snapshots/{hash}/"""
    pattern = os.path.join(RUNPOD_HF_CACHE, f"models--{model_id.replace('/', '--')}", "snapshots", "*")
    snapshots = sorted(glob.glob(pattern), key=os.path.getmtime, reverse=True)
    if snapshots:
        log(f"model önbellekte bulundu: {snapshots[0]}")
        return snapshots[0]
    if ALLOW_DOWNLOAD:
        log(f"UYARI: {model_id} önbellekte yok, HF'den indirilecek (yavaş!)")
        return model_id
    raise RuntimeError(
        f"{model_id} RunPod önbelleğinde yok ({pattern}). Endpoint ayarındaki 'Model' alanını "
        f"MODEL_ID ile aynı yapın veya geliştirme için ALLOW_DOWNLOAD=1 verin."
    )


def install_maskless_attention() -> None:
    """
    Hunyuan 1.5 her attention çağrısına seq×seq boyutunda bir dolgu maskesi verir (yalnızca metin
    token'larındaki padding için). Dolu maske SDPA'nın Flash yolunu kapatır, SageAttention ise maskeyi
    hiç desteklemez. Batch 1'de (CFG kapalı) dolgu token'larını attention'dan çıkarıp maskesiz hesaplamak
    geçerli token'lar için birebir aynı sonucu verir; dolgu satırları sıfır döner (zaten maskeli).
    """
    import diffusers.models.transformers.transformer_hunyuan_video15 as hv

    original = hv.dispatch_attention_fn

    def dispatch(query, key, value, attn_mask=None, **kwargs):
        if attn_mask is None or query.shape[0] != 1:
            return original(query, key, value, attn_mask=attn_mask, **kwargs)
        valid = attn_mask[0, 0].any(dim=0)  # sütun j geçerliyse en az bir satırda True
        if bool(valid.all()):
            return original(query, key, value, attn_mask=None, **kwargs)
        idx = valid.nonzero(as_tuple=True)[0]
        out = query.new_zeros(query.shape[:3] + (value.shape[-1],))
        out[:, idx] = original(query[:, idx], key[:, idx], value[:, idx], attn_mask=None, **kwargs)
        return out

    hv.dispatch_attention_fn = dispatch


def set_attention_backend(pipe) -> str:
    if ATTENTION_BACKEND == "native":
        return "native"
    try:
        t0 = time.time()
        from diffusers.models.attention_dispatch import _HUB_KERNELS_REGISTRY, AttentionBackendName

        hub_cfg = _HUB_KERNELS_REGISTRY.get(AttentionBackendName(ATTENTION_BACKEND))
        if hub_cfg is not None and ATTENTION_BACKEND == "sage_hub":
            hub_cfg.version = SAGE_KERNEL_VERSION
        pipe.transformer.set_attention_backend(ATTENTION_BACKEND)
        log(f"attention backend: {ATTENTION_BACKEND} ({time.time() - t0:.1f}s)")
        return ATTENTION_BACKEND
    except Exception as e:  # kernel indirilemezse veya GPU desteklemezse hızlı yola düş
        global ATTENTION_ERROR
        ATTENTION_ERROR = f"{type(e).__name__}: {e}"[:500]
        log(f"UYARI: {ATTENTION_BACKEND} kullanılamadı ({ATTENTION_ERROR}); native SDPA'ya dönülüyor")
        return "native"


def load_pipeline():
    path = resolve_model_path(MODEL_ID)
    t0 = time.time()
    if MODEL_FAMILY == "hunyuan15":
        from diffusers import HunyuanVideo15ImageToVideoPipeline as Pipeline
    elif MODEL_FAMILY == "ltx2":
        from diffusers import LTX2ImageToVideoPipeline as Pipeline
    elif MODEL_FAMILY == "wan22":
        from diffusers import WanImageToVideoPipeline as Pipeline
    elif MODEL_FAMILY == "qwen_edit":
        from diffusers import QwenImageEditPlusPipeline as Pipeline
    else:
        raise ValueError(f"bilinmeyen MODEL_FAMILY: {MODEL_FAMILY}")
    pipe = Pipeline.from_pretrained(path, torch_dtype=torch.bfloat16)
    log(f"ağırlıklar diskten okundu: {time.time() - t0:.1f}s")

    t1 = time.time()
    offload = CPU_OFFLOAD == "1" or (CPU_OFFLOAD == "auto" and VRAM_GB < 70)
    if offload:
        pipe.enable_model_cpu_offload()
    else:
        pipe.to("cuda")
    # Tiling ayarı iş başına yapılır (bkz. configure_vae_tiling).
    global ATTENTION_IN_USE
    if MODEL_FAMILY == "hunyuan15":
        install_maskless_attention()
        ATTENTION_IN_USE = set_attention_backend(pipe)
    log(f"GPU'ya hazırlandı: {time.time() - t1:.1f}s (vram={VRAM_GB:.0f}GB, cpu_offload={offload})")
    return pipe


def load_upscaler():
    if not os.path.exists(UPSCALER_PATH):
        log(f"UYARI: upscaler ağırlığı yok ({UPSCALER_PATH}); videolar üretim çözünürlüğünde döner")
        return None
    from spandrel import ModelLoader

    model = ModelLoader().load_from_file(UPSCALER_PATH).to("cuda").eval()
    if model.supports_half:
        model = model.half()
    log(f"upscaler hazır: {model.architecture.name} x{model.scale}")
    return model


def r2_client():
    account = os.environ.get("R2_ACCOUNT_ID")
    if not account:
        log("UYARI: R2 ayarları yok; çıktı base64 olarak döner (yalnızca test için)")
        return None
    return boto3.client(
        "s3",
        endpoint_url=f"https://{account}.r2.cloudflarestorage.com",
        aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
        region_name="auto",
    )


GPU_NAME = torch.cuda.get_device_name(0)
VRAM_GB = torch.cuda.get_device_properties(0).total_memory / 1024**3
log(f"açılış: family={MODEL_FAMILY} model={MODEL_ID} gpu={GPU_NAME} vram={VRAM_GB:.0f}GB")
PIPE = load_pipeline()
UPSCALER = load_upscaler()
S3 = r2_client()
BOOT_SECONDS = time.time() - T_START
log(f"hazır, toplam açılış {BOOT_SECONDS:.1f}s")


def load_image(url: str, width: int, height: int) -> Image.Image:
    if url.startswith("data:"):
        import base64

        img = Image.open(BytesIO(base64.b64decode(url.split(",", 1)[1])))
    else:
        r = requests.get(url, timeout=30)
        r.raise_for_status()
        img = Image.open(BytesIO(r.content))
    img = img.convert("RGB")
    # Hedef en-boy oranına merkezden kırp, sonra ölçekle (gerilmiş arsa görüntüsü olmasın).
    target = width / height
    w, h = img.size
    if w / h > target:
        nw = int(h * target)
        img = img.crop(((w - nw) // 2, 0, (w - nw) // 2 + nw, h))
    else:
        nh = int(w / target)
        img = img.crop((0, (h - nh) // 2, w, (h - nh) // 2 + nh))
    return img.resize((width, height), Image.LANCZOS)


# Tiling'siz VAE çözümlemesi 96 GB kartta 81 kare 848x480'de en yüksek ~88 GB kullanıyor (2026-10-14).
# Bundan büyük işlerde (daha çok kare / çözünürlük) bellek taşmaması için tiling açılır.
UNTILED_MAX_PIXELS = 81 * 848 * 480


def configure_vae_tiling(inp: dict) -> bool:
    """Tiling yalnızca bellek tasarrufu içindir; kapalıyken tek parça çözümleme hem daha hızlı hem dikişsiz."""
    pixels = inp["num_frames"] * inp["width"] * inp["height"]
    # Eşik Hunyuan için ölçüldü; Wan 2.2 (~70 GB ağırlık) 96 GB kartta tiling'siz çözümlemeye yer bırakmaz.
    tiling = VRAM_GB < 70 or pixels > UNTILED_MAX_PIXELS or MODEL_FAMILY != "hunyuan15"
    if tiling:
        PIPE.vae.enable_tiling()
    else:
        PIPE.vae.disable_tiling()
    return tiling


def generate(inp: dict) -> list:
    configure_vae_tiling(inp)
    image = load_image(inp["image_url"], inp["width"], inp["height"])
    generator = torch.Generator("cuda").manual_seed(int(inp.get("seed", 42)))

    if MODEL_FAMILY == "wan22":
        # last_image verilirse ilk/son kare arası geçiş (inşaat timelapse); yoksa normal i2v.
        last = inp.get("last_image_url")
        return PIPE(
            image=image,
            last_image=load_image(last, inp["width"], inp["height"]) if last else None,
            prompt=inp["prompt"],
            negative_prompt=inp.get("negative_prompt"),
            width=inp["width"],
            height=inp["height"],
            num_frames=inp["num_frames"],
            num_inference_steps=int(inp.get("num_steps", 4)),
            guidance_scale=float(inp.get("guidance_scale", 1.0)),
            guidance_scale_2=float(inp.get("guidance_scale", 1.0)),
            generator=generator,
            output_type="np",
        ).frames[0]

    if MODEL_FAMILY == "hunyuan15":
        # Çözünürlük modelin kendi ızgarasından (480p) ve görselin en-boy oranından gelir.
        return PIPE(
            prompt=inp["prompt"],
            image=image,
            num_frames=inp["num_frames"],
            num_inference_steps=int(inp.get("num_steps", NUM_STEPS)),
            generator=generator,
        ).frames[0]

    from diffusers.pipelines.ltx2.utils import DISTILLED_SIGMA_VALUES

    video, _audio = PIPE(  # LTX-2 sesi de üretir; biz TTS + müzik kullandığımız için atılır.
        image=image,
        prompt=inp["prompt"],
        width=inp["width"],
        height=inp["height"],
        num_frames=inp["num_frames"],
        frame_rate=float(inp.get("frame_rate", 24)),
        sigmas=DISTILLED_SIGMA_VALUES,
        guidance_scale=1.0,
        generator=generator,
        output_type="np",
        return_dict=False,
    )
    return list(video[0])


def frames_to_tensor(frames) -> torch.Tensor:
    """Pipeline çıktısını (np dizi, np listesi veya PIL listesi) [F,3,H,W] float 0..1 tensöre çevirir."""
    import numpy as np

    if isinstance(frames, np.ndarray):
        arr = frames
    else:
        arr = np.stack([np.asarray(f) for f in frames])
    t = torch.from_numpy(arr)
    if t.dtype == torch.uint8:
        t = t.float().div(255)
    return t.permute(0, 3, 1, 2).float().clamp(0, 1)


def fit_to(x: torch.Tensor, out_w: int, out_h: int) -> torch.Tensor:
    """Kenarları kaplayacak şekilde ölçekler, fazlasını ortadan kırpar (germe yok)."""
    _, _, h, w = x.shape
    scale = max(out_w / w, out_h / h)
    nh, nw = max(out_h, round(h * scale)), max(out_w, round(w * scale))
    x = torch.nn.functional.interpolate(x, size=(nh, nw), mode="bicubic", antialias=True, align_corners=False)
    top, left = (nh - out_h) // 2, (nw - out_w) // 2
    return x[:, :, top : top + out_h, left : left + out_w].clamp(0, 1)


def encode_video(frames: torch.Tensor, path: str, fps: int, out_w: int, out_h: int, upscale: bool) -> None:
    """Kareleri (gerekirse Real-ESRGAN ile büyütüp) ffmpeg'e akıtarak yüksek kaliteli H.264 yazar."""
    enc = subprocess.Popen(
        ["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{out_w}x{out_h}",
         "-r", str(fps), "-i", "-", "-c:v", "libx264", "-preset", "fast", "-crf", "16",
         "-pix_fmt", "yuv420p", "-movflags", "+faststart", path],
        stdin=subprocess.PIPE,
    )
    dtype = torch.float16 if UPSCALER is not None and UPSCALER.supports_half else torch.float32
    with torch.inference_mode():
        for i in range(0, frames.shape[0], UPSCALE_BATCH):
            x = frames[i : i + UPSCALE_BATCH].to("cuda")
            if upscale:
                x = UPSCALER(x.to(dtype)).float()
            y = fit_to(x, out_w, out_h)
            enc.stdin.write(y.mul(255).round().byte().permute(0, 2, 3, 1).contiguous().cpu().numpy().tobytes())
    enc.stdin.close()
    if enc.wait() != 0:
        raise RuntimeError("ffmpeg kodlama hatası")


def edit_image(inp: dict) -> dict:
    """Qwen-Image-Edit: girdi görseli talimatla düzenler, aynı boyutta PNG (base64) döndürür."""
    import base64

    src = load_image(inp["image_url"], inp["width"], inp["height"])
    t0 = time.time()
    out = PIPE(
        image=[src],
        prompt=inp["prompt"],
        negative_prompt=inp.get("negative_prompt") or " ",
        true_cfg_scale=float(inp.get("true_cfg_scale", 4.0)),
        num_inference_steps=int(inp.get("num_steps", 40)),
        generator=torch.Generator("cuda").manual_seed(int(inp.get("seed", 42))),
    ).images[0]
    t_gen = time.time() - t0
    # Model ~1 MP çıktı verir; drone karesiyle birebir hizalı olması için girdi boyutuna geri ölçekle.
    out = out.convert("RGB").resize(src.size, Image.LANCZOS)
    buf = BytesIO()
    out.save(buf, format="PNG")
    log(f"görsel düzenleme {t_gen:.1f}s ({src.size[0]}x{src.size[1]})")
    return {
        "image_base64": base64.b64encode(buf.getvalue()).decode(),
        "gpu": GPU_NAME,
        "peak_vram_gb": round(torch.cuda.max_memory_allocated() / 1024**3, 1),
        "timings": {"boot_seconds": round(BOOT_SECONDS, 1), "generate_seconds": round(t_gen, 1)},
    }


def handler(job):
    inp = job["input"]
    if inp.get("warmup"):
        return {"warm": True, "boot_seconds": round(BOOT_SECONDS, 1), "gpu": GPU_NAME}
    if MODEL_FAMILY in IMAGE_FAMILIES:
        torch.cuda.reset_peak_memory_stats()
        return edit_image(inp)

    torch.cuda.reset_peak_memory_stats()
    t0 = time.time()
    frames = generate(inp)
    t_gen = time.time() - t0
    log(f"üretim {t_gen:.1f}s ({inp['num_frames']} kare)")

    t_up = time.time()
    frames_t = frames_to_tensor(frames)
    _, _, src_h, src_w = frames_t.shape
    out_w = int(inp.get("output_width") or src_w)
    out_h = int(inp.get("output_height") or src_h)
    upscale = UPSCALER is not None and (out_w > src_w or out_h > src_h)
    with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as f:
        path = f.name
    encode_video(frames_t, path, int(inp.get("frame_rate", 24)), out_w, out_h, upscale)
    t_up = time.time() - t_up
    log(f"kodlama {t_up:.1f}s ({src_w}x{src_h} -> {out_w}x{out_h}, upscale={upscale})")

    t1 = time.time()
    if S3 is not None:
        key = inp["output_key"]
        S3.upload_file(path, R2_BUCKET, key, ExtraArgs={"ContentType": "video/mp4"})
        result = {"video_url": f"{R2_PUBLIC_BASE_URL}/{key}"}
    else:
        import base64

        with open(path, "rb") as f:
            result = {"video_base64": base64.b64encode(f.read()).decode()}
    os.unlink(path)

    return {
        **result,
        "gpu": GPU_NAME,
        "resolution": f"{out_w}x{out_h}",
        "upscaled": upscale,
        "attention": ATTENTION_IN_USE,
        **({"attention_error": ATTENTION_ERROR} if ATTENTION_ERROR else {}),
        "peak_vram_gb": round(torch.cuda.max_memory_allocated() / 1024**3, 1),
        "timings": {
            "boot_seconds": round(BOOT_SECONDS, 1),
            "generate_seconds": round(t_gen, 1),
            "upscale_encode_seconds": round(t_up, 1),
            "upload_seconds": round(time.time() - t1, 1),
        },
    }


if __name__ == "__main__":
    runpod.serverless.start({"handler": handler})
