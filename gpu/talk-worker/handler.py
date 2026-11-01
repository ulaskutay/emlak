"""
RunPod Serverless worker: konuşan emlakçı (InfiniteTalk, Wan2.1-I2V-14B tabanlı ses güdümlü video).

Fotoğraf (odada duran emlakçı) + seslendirme → dudakları, mimiği ve başı sese oturan video. Çıktıda ses de vardır.

Ağırlıklar:
  * Wan2.1-I2V-14B-480P: RunPod "cached models" önbelleği. Endpoint ayarındaki "Model" alanı BASE_MODEL_ID olmalı.
  * InfiniteTalk tek kişi ses ağırlıkları, chinese-wav2vec2-base ve lightx2v adım damıtma LoRA'sı (~11 GB):
    ilk açılışta WEIGHTS_DIR'e indirilir, sonraki açılışlarda diskte varsa indirilmez.

Bellek: resmi yükleyici 7 parçalık fp32 DiT'i (66 GB) RAM'de birleştirip sonra bf16'ya çevirir (~105 GB RAM).
Parçalar okunurken bf16'ya çevrilerek tepe RAM yarıya iner (bkz. bf16_load_file). 80 GB kartta model GPU'da kalır,
daha küçük kartlarda DiT katmanları sırayla GPU'ya alınır (yavaş).

Input şeması packages/providers/src/runpod.ts içindeki TalkWorkerInput ile aynı tutulmalıdır.
"""

import base64
import os
import sys
import tempfile
import time
import types
from io import BytesIO

os.environ.setdefault("PYTORCH_CUDA_ALLOC_CONF", "expandable_segments:True")

import glob
import subprocess

IT_DIR = os.environ.get("INFINITETALK_DIR", "/app/infinitetalk")
sys.path.insert(0, IT_DIR)
# generate_infinitetalk.py en üstte kokoro TTS'i içe aktarıyor; ses dışarıdan (ElevenLabs) geldiği için gerekmez.
sys.modules.setdefault("kokoro", types.SimpleNamespace(KPipeline=None))
# wan/multitalk.py kullanmadığı inspect.ArgSpec'i içe aktarıyor; Python 3.11'de kaldırıldı (resmi kurulum 3.10).
import inspect

if not hasattr(inspect, "ArgSpec"):
    inspect.ArgSpec = inspect.FullArgSpec

import boto3
import requests
import runpod
import soundfile as sf
import torch
from PIL import Image

import generate_infinitetalk as gi
import wan
import wan.multitalk
from wan.configs import WAN_CONFIGS

if os.environ.get("TALK_IMPORT_CHECK") == "1":
    print("import denemesi tamam")
    sys.exit(0)

BASE_MODEL_ID = os.environ.get("BASE_MODEL_ID", "Wan-AI/Wan2.1-I2V-14B-480P")
RUNPOD_HF_CACHE = os.environ.get("RUNPOD_HF_CACHE", "/runpod-volume/huggingface-cache/hub")
WEIGHTS_DIR = os.environ.get("WEIGHTS_DIR", "/app/weights")
# Önbellekte temel model yoksa HF'den indirmeye izin ver (yalnızca geliştirme için; 82 GB!).
ALLOW_DOWNLOAD = os.environ.get("ALLOW_DOWNLOAD", "0") == "1"
# 0: DiT tamamen GPU'da (80 GB kart). Küçük kartta auto, katmanları sırayla GPU'ya alır.
VRAM_MODE = os.environ.get("VRAM_MODE", "auto")

LORA_FILE = "Wan21_T2V_14B_lightx2v_cfg_step_distill_lora_rank32.safetensors"

R2_BUCKET = os.environ.get("R2_BUCKET", "")
R2_PUBLIC_BASE_URL = os.environ.get("R2_PUBLIC_BASE_URL", "").rstrip("/")

T_START = time.time()


def log(msg: str) -> None:
    print(f"[talk +{time.time() - T_START:6.1f}s] {msg}", flush=True)


def resolve_base_model() -> str:
    pattern = os.path.join(RUNPOD_HF_CACHE, f"models--{BASE_MODEL_ID.replace('/', '--')}", "snapshots", "*")
    snapshots = sorted(glob.glob(pattern), key=os.path.getmtime, reverse=True)
    if snapshots:
        log(f"temel model önbellekte: {snapshots[0]}")
        return snapshots[0]
    if not ALLOW_DOWNLOAD:
        raise RuntimeError(
            f"{BASE_MODEL_ID} RunPod önbelleğinde yok ({pattern}). Endpoint'in 'Model' alanını "
            f"{BASE_MODEL_ID} yapın veya geliştirme için ALLOW_DOWNLOAD=1 verin."
        )
    from huggingface_hub import snapshot_download

    log(f"UYARI: {BASE_MODEL_ID} HF'den indiriliyor (82 GB, yavaş!)")
    return snapshot_download(BASE_MODEL_ID, local_dir=os.path.join(WEIGHTS_DIR, "base"))


def ensure_weights() -> dict:
    """InfiniteTalk, wav2vec ve LoRA dosyalarını WEIGHTS_DIR'e indirir (varsa atlar)."""
    from huggingface_hub import hf_hub_download

    t0 = time.time()
    w2v = os.path.join(WEIGHTS_DIR, "chinese-wav2vec2-base")
    for name in ("config.json", "preprocessor_config.json"):
        hf_hub_download("TencentGameMate/chinese-wav2vec2-base", name, local_dir=w2v)
    # main dalında yalnızca .bin var; transformers safetensors'ı tercih eder (resmi kurulumdaki refs/pr/1).
    hf_hub_download("TencentGameMate/chinese-wav2vec2-base", "model.safetensors", revision="refs/pr/1", local_dir=w2v)
    talk = hf_hub_download("MeiGen-AI/InfiniteTalk", "single/infinitetalk.safetensors", local_dir=os.path.join(WEIGHTS_DIR, "InfiniteTalk"))
    lora = hf_hub_download("Kijai/WanVideo_comfy", LORA_FILE, local_dir=os.path.join(WEIGHTS_DIR, "lora"))
    log(f"ek ağırlıklar hazır ({time.time() - t0:.1f}s)")
    return {"wav2vec": w2v, "infinitetalk": talk, "lora": lora}


def bf16_load_file(path, device="cpu"):
    """safetensors.load_file yerine: fp32 parçayı okurken bf16'ya çevirir; model zaten bf16 tutulur."""
    from safetensors.torch import load_file

    sd = load_file(path, device=device)
    for k, v in sd.items():
        if v.dtype == torch.float32:
            sd[k] = v.to(torch.bfloat16)
    return sd


def load_pipeline(base_dir: str, weights: dict):
    t0 = time.time()
    wan.multitalk.load_file = bf16_load_file
    pipe = wan.InfiniteTalkPipeline(
        config=WAN_CONFIGS["infinitetalk-14B"],
        checkpoint_dir=base_dir,
        device_id=0,
        rank=0,
        lora_dir=[weights["lora"]],
        lora_scales=[1.0],
        infinitetalk_dir=weights["infinitetalk"],
    )
    persistent = None
    if VRAM_MODE == "auto" and VRAM_GB < 70:
        persistent = 0
    elif VRAM_MODE not in ("auto", "gpu"):
        persistent = int(VRAM_MODE)
    if persistent is not None:
        pipe.vram_management = True
        pipe.enable_vram_management(num_persistent_param_in_dit=persistent)
    log(f"pipeline hazır ({time.time() - t0:.1f}s, vram_management={persistent is not None})")
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
log(f"açılış: gpu={GPU_NAME} vram={VRAM_GB:.0f}GB")
BASE_DIR = resolve_base_model()
WEIGHTS = ensure_weights()
PIPE = load_pipeline(BASE_DIR, WEIGHTS)
W2V_EXTRACTOR, W2V_ENCODER = gi.custom_init("cpu", WEIGHTS["wav2vec"])
S3 = r2_client()
BOOT_SECONDS = time.time() - T_START
log(f"hazır, toplam açılış {BOOT_SECONDS:.1f}s")


def fetch(url: str, path: str) -> None:
    if url.startswith("data:"):
        data = base64.b64decode(url.split(",", 1)[1])
    else:
        r = requests.get(url, timeout=60)
        r.raise_for_status()
        data = r.content
    with open(path, "wb") as f:
        f.write(data)


def generation_args(inp: dict, size: str):
    """generate_infinitetalk() extra_args olarak argparse nesnesi bekliyor; kullandığı alanlar bunlar."""
    return types.SimpleNamespace(
        size=size,
        use_teacache=bool(inp.get("use_teacache", False)),
        teacache_thresh=float(inp.get("teacache_thresh", 0.2)),
        use_apg=bool(inp.get("use_apg", False)),
        apg_momentum=float(inp.get("apg_momentum", -0.75)),
        apg_norm_threshold=float(inp.get("apg_norm_threshold", 55)),
    )


def handler(job):
    inp = job["input"]
    if inp.get("warmup"):
        return {"warm": True, "boot_seconds": round(BOOT_SECONDS, 1), "gpu": GPU_NAME}

    torch.cuda.reset_peak_memory_stats()
    work = tempfile.mkdtemp(prefix="talk-")
    image_path = os.path.join(work, "ref.png")
    audio_src = os.path.join(work, "audio-src")
    fetch(inp["image_url"], image_path)
    fetch(inp["audio_url"], audio_src)
    # Resim olduğu gibi kalsın; kova (ör. 9:16 → 448x832) seçimini ve kırpmayı InfiniteTalk yapar.
    Image.open(image_path).convert("RGB").save(image_path)

    t0 = time.time()
    speech = gi.audio_prepare_single(audio_src)
    # Sessiz kuyruk: cümle bitince ağız kapansın, video sesle birlikte bitsin.
    tail = float(inp.get("tail_seconds", 0.3))
    if tail > 0:
        import numpy as np

        speech = np.concatenate([speech, np.zeros(int(16000 * tail), dtype=speech.dtype)])
    emb = gi.get_embedding(speech, W2V_EXTRACTOR, W2V_ENCODER)
    emb_path = os.path.join(work, "1.pt")
    wav_path = os.path.join(work, "speech.wav")
    torch.save(emb, emb_path)
    sf.write(wav_path, speech, 16000)
    t_audio = time.time() - t0

    size = f"infinitetalk-{inp.get('resolution', '480')}"
    t0 = time.time()
    video = PIPE.generate_infinitetalk(
        {
            "prompt": inp["prompt"],
            "cond_video": image_path,
            "cond_audio": {"person1": emb_path},
            "video_audio": wav_path,
        },
        size_buckget=size,
        motion_frame=int(inp.get("motion_frame", 9)),
        frame_num=81,
        shift=float(inp.get("shift", 2.0)),
        sampling_steps=int(inp.get("num_steps", 4)),
        text_guide_scale=float(inp.get("text_guide_scale", 1.0)),
        audio_guide_scale=float(inp.get("audio_guide_scale", 2.0)),
        n_prompt=inp.get("negative_prompt", ""),
        seed=int(inp.get("seed", 42)),
        offload_model=VRAM_GB < 70,
        max_frames_num=int(inp.get("max_frames", 1000)),
        color_correction_strength=float(inp.get("color_correction_strength", 1.0)),
        extra_args=generation_args(inp, size),
    )
    t_gen = time.time() - t0
    _, frames, height, width = video.shape
    log(f"üretim {t_gen:.1f}s ({frames} kare, {width}x{height})")

    t0 = time.time()
    stem = os.path.join(work, "out")
    from wan.utils.multitalk_utils import save_video_ffmpeg

    save_video_ffmpeg(video, stem, [wav_path], high_quality_save=False)
    path = stem + ".mp4"
    t_enc = time.time() - t0

    t0 = time.time()
    if S3 is not None and inp.get("output_key"):
        key = inp["output_key"]
        S3.upload_file(path, R2_BUCKET, key, ExtraArgs={"ContentType": "video/mp4"})
        url = (
            f"{R2_PUBLIC_BASE_URL}/{key}"
            if R2_PUBLIC_BASE_URL
            else S3.generate_presigned_url("get_object", Params={"Bucket": R2_BUCKET, "Key": key}, ExpiresIn=7 * 24 * 3600)
        )
        result = {"video_url": url}
    else:
        with open(path, "rb") as f:
            result = {"video_base64": base64.b64encode(f.read()).decode()}
    subprocess.run(["rm", "-rf", work], check=False)

    return {
        **result,
        "gpu": GPU_NAME,
        "resolution": f"{width}x{height}",
        "frames": frames,
        "duration_seconds": round(frames / 25, 2),
        "peak_vram_gb": round(torch.cuda.max_memory_allocated() / 1024**3, 1),
        "timings": {
            "boot_seconds": round(BOOT_SECONDS, 1),
            "audio_seconds": round(t_audio, 1),
            "generate_seconds": round(t_gen, 1),
            "encode_seconds": round(t_enc, 1),
            "upload_seconds": round(time.time() - t0, 1),
        },
    }


if __name__ == "__main__":
    runpod.serverless.start({"handler": handler})
