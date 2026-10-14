"""
RunPod Serverless worker: LTX-2 image-to-video (emlak/arsa sahneleri).

Hız için tasarım:
  * Model, süreç açılırken BİR KEZ GPU'ya yüklenir (modül seviyesi). Sonraki işler sıcak süreçte çalışır.
  * Model ağırlıkları Docker imajına gömülüdür (HF_HUB_OFFLINE=1), açılışta indirme yapılmaz.
  * Distilled model + sabit sigma takvimi (~8 adım, CFG yok).
  * Çıktı doğrudan R2'ye yüklenir, panel yalnızca URL alır.

Input şeması packages/providers/src/runpod.ts içindeki LtxWorkerInput ile aynı tutulmalıdır.
"""

import os
import tempfile
import time
from io import BytesIO

import boto3
import requests
import runpod
import torch
from diffusers import LTX2ImageToVideoPipeline
from diffusers.utils import export_to_video
from PIL import Image

MODEL_ID = os.environ.get("MODEL_ID", "Lightricks/LTX-2.5-Diffusers")
USE_DISTILLED_SIGMAS = os.environ.get("USE_DISTILLED_SIGMAS", "1") == "1"
# 48 GB kartlarda (L40S) gerekebilir; H100 80 GB'da kapalı olmalı (yavaşlatır).
CPU_OFFLOAD = os.environ.get("CPU_OFFLOAD", "0") == "1"
TORCH_COMPILE = os.environ.get("TORCH_COMPILE", "0") == "1"

R2_BUCKET = os.environ.get("R2_BUCKET", "")
R2_PUBLIC_BASE_URL = os.environ.get("R2_PUBLIC_BASE_URL", "").rstrip("/")


def _load_pipeline():
    t0 = time.time()
    pipe = LTX2ImageToVideoPipeline.from_pretrained(MODEL_ID, torch_dtype=torch.bfloat16)
    if CPU_OFFLOAD:
        pipe.enable_model_cpu_offload()
    else:
        pipe.to("cuda")
    pipe.vae.enable_tiling()
    if TORCH_COMPILE:
        pipe.transformer = torch.compile(pipe.transformer, mode="max-autotune-no-cudagraphs")
    print(f"[boot] {MODEL_ID} yüklendi: {time.time() - t0:.1f}s", flush=True)
    return pipe


def _r2_client():
    account = os.environ.get("R2_ACCOUNT_ID")
    if not account:
        return None
    return boto3.client(
        "s3",
        endpoint_url=f"https://{account}.r2.cloudflarestorage.com",
        aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
        region_name="auto",
    )


BOOT_STARTED = time.time()
PIPE = _load_pipeline()
S3 = _r2_client()
BOOT_SECONDS = time.time() - BOOT_STARTED

if USE_DISTILLED_SIGMAS:
    from diffusers.pipelines.ltx2.utils import DISTILLED_SIGMA_VALUES
else:
    DISTILLED_SIGMA_VALUES = None


def _load_image(url: str, width: int, height: int) -> Image.Image:
    r = requests.get(url, timeout=30)
    r.raise_for_status()
    img = Image.open(BytesIO(r.content)).convert("RGB")
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


def _generate(inp: dict) -> list:
    image = _load_image(inp["image_url"], inp["width"], inp["height"])
    kwargs = dict(
        image=image,
        prompt=inp["prompt"],
        width=inp["width"],
        height=inp["height"],
        num_frames=inp["num_frames"],
        frame_rate=float(inp.get("frame_rate", 24)),
        generator=torch.Generator("cuda").manual_seed(int(inp.get("seed", 42))),
        output_type="np",
        return_dict=False,
    )
    if DISTILLED_SIGMA_VALUES is not None:
        # Distilled: sabit sigma takvimi, CFG yok (negative prompt kullanılmaz).
        kwargs.update(sigmas=DISTILLED_SIGMA_VALUES, guidance_scale=1.0)
    else:
        kwargs.update(negative_prompt=inp.get("negative_prompt"), num_inference_steps=30, guidance_scale=3.0)
    # LTX-2 sesi de üretir; biz TTS + müzik kullandığımız için ses atılır.
    video, _audio = PIPE(**kwargs)
    return list(video[0])


def handler(job):
    inp = job["input"]
    if inp.get("warmup"):
        return {"warm": True, "boot_seconds": round(BOOT_SECONDS, 1)}

    t0 = time.time()
    frames = _generate(inp)
    t_gen = time.time() - t0

    with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as f:
        path = f.name
    export_to_video(frames, path, fps=int(inp.get("frame_rate", 24)))

    t1 = time.time()
    key = inp["output_key"]
    if S3 is None:
        raise RuntimeError("R2 ayarları eksik (R2_ACCOUNT_ID vb.)")
    S3.upload_file(path, R2_BUCKET, key, ExtraArgs={"ContentType": "video/mp4"})
    os.unlink(path)

    return {
        "video_url": f"{R2_PUBLIC_BASE_URL}/{key}",
        "timings": {
            "boot_seconds": round(BOOT_SECONDS, 1),
            "generate_seconds": round(t_gen, 1),
            "upload_seconds": round(time.time() - t1, 1),
        },
    }


if __name__ == "__main__":
    runpod.serverless.start({"handler": handler})
