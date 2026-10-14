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

import boto3
import requests
import runpod
import torch
from diffusers.utils import export_to_video
from PIL import Image

MODEL_FAMILY = os.environ.get("MODEL_FAMILY", "hunyuan15")
DEFAULT_MODELS = {
    "hunyuan15": "hunyuanvideo-community/HunyuanVideo-1.5-Diffusers-480p_i2v_step_distilled",
    "ltx2": "Lightricks/LTX-2.5-Diffusers",
}
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
ATTENTION_BACKEND = os.environ.get("ATTENTION_BACKEND", "sage_hub")

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
    pipe.vae.enable_tiling()
    global ATTENTION_IN_USE
    if MODEL_FAMILY == "hunyuan15":
        install_maskless_attention()
        ATTENTION_IN_USE = set_attention_backend(pipe)
    log(f"GPU'ya hazırlandı: {time.time() - t1:.1f}s (vram={VRAM_GB:.0f}GB, cpu_offload={offload})")
    return pipe


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


def generate(inp: dict) -> list:
    image = load_image(inp["image_url"], inp["width"], inp["height"])
    generator = torch.Generator("cuda").manual_seed(int(inp.get("seed", 42)))

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


def handler(job):
    inp = job["input"]
    if inp.get("warmup"):
        return {"warm": True, "boot_seconds": round(BOOT_SECONDS, 1), "gpu": GPU_NAME}

    torch.cuda.reset_peak_memory_stats()
    t0 = time.time()
    frames = generate(inp)
    t_gen = time.time() - t0
    log(f"üretim {t_gen:.1f}s ({inp['num_frames']} kare)")

    with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as f:
        path = f.name
    export_to_video(frames, path, fps=int(inp.get("frame_rate", 24)))

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
        "attention": ATTENTION_IN_USE,
        **({"attention_error": ATTENTION_ERROR} if ATTENTION_ERROR else {}),
        "peak_vram_gb": round(torch.cuda.max_memory_allocated() / 1024**3, 1),
        "timings": {
            "boot_seconds": round(BOOT_SECONDS, 1),
            "generate_seconds": round(t_gen, 1),
            "upload_seconds": round(time.time() - t1, 1),
        },
    }


if __name__ == "__main__":
    runpod.serverless.start({"handler": handler})
