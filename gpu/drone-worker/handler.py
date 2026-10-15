"""
RunPod Serverless drone worker: parsel (TKGM GeoJSON / KML) → Google 3D harita drone videosu.

Render motoru Node/Playwright tarafında (apps/drone-studio/scripts/render.ts); bu handler yalnızca
işi alır, worker-render.ts'yi çalıştırır ve çıktıyı R2'ye yükler (yoksa base64 döndürür).

Girdi:
  parcel        TKGM GeoJSON veya KML metni (zorunlu)
  fps           varsayılan 30
  parallel      paralel sayfa; varsayılan çekirdek sayısına göre (en fazla 8)
  crf           video kalitesi (düşük = kaliteli/büyük); varsayılan 22
  limit_frames  test için yalnızca ilk N kare
  output_prefix R2 anahtar öneki, ör. "projects/123/drone"
Ortam: GOOGLE_MAPS_API_KEY (zorunlu), R2_* (opsiyonel)
"""

import base64
import json
import os
import subprocess
import tempfile
import threading
import time

import boto3
import runpod

APP_DIR = "/app/apps/drone-studio"
# pnpm/corepack katmanı olmadan doğrudan tsx (istem/indirme riski yok)
TSX = [os.path.join(APP_DIR, "node_modules/.bin/tsx")]
R2_BUCKET = os.environ.get("R2_BUCKET", "")
R2_PUBLIC_BASE_URL = os.environ.get("R2_PUBLIC_BASE_URL", "").rstrip("/")
# RunPod yanıt gövdesi büyük videoları taşıyamaz; R2 yoksa bu boyutun üstü hata.
MAX_INLINE_MB = 18


def r2_client():
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


S3 = r2_client()
print(f"[drone-worker] hazır · R2={'var' if S3 else 'yok (base64)'}", flush=True)


def publish(path: str, key: str, content_type: str, inline_ok: bool = True) -> dict:
    if S3 is not None:
        S3.upload_file(path, R2_BUCKET, key, ExtraArgs={"ContentType": content_type})
        return {"url": f"{R2_PUBLIC_BASE_URL}/{key}"}
    size_mb = os.path.getsize(path) / 1024**2
    if not inline_ok or size_mb > MAX_INLINE_MB:
        raise RuntimeError(f"{os.path.basename(path)} {size_mb:.1f} MB — base64 için çok büyük; R2 ayarlarını girin")
    with open(path, "rb") as f:
        return {"base64": base64.b64encode(f.read()).decode()}


def to_jpeg(png_path: str) -> str:
    """Anahtar kareler PNG (~3 MB); yanıt için yüksek kaliteli JPEG yeterli."""
    jpg = png_path.rsplit(".", 1)[0] + ".jpg"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", png_path, "-q:v", "2", jpg], check=True)
    return jpg


def container_cpus() -> int:
    """Konteynere ayrılan CPU (cgroup kotası). os.cpu_count() RunPod'da ana makinenin tümünü (ör. 256) gösterir."""
    try:
        quota, period = open("/sys/fs/cgroup/cpu.max").read().split()
        if quota != "max":
            return max(1, int(int(quota) / int(period)))
    except (OSError, ValueError):
        pass
    try:
        return len(os.sched_getaffinity(0))
    except AttributeError:
        return os.cpu_count() or 4


def run_streaming(cmd: list[str], env: dict, timeout: int) -> str:
    """Komutu çalıştırır; stderr satır satır RunPod loglarına akar, stdout'un son satırını döndürür.

    stdout bir dosyaya yazılır: Linux'ta Node'un pipe'a yazımı eşzamanlıdır, okunmayan bir stdout
    pipe'ı dolunca tüm olay döngüsü (zaman aşımları dahil) donar. stdin kapalı: hiçbir istem beklemesin.
    """
    out_path = tempfile.mktemp(suffix=".stdout")
    tail: list[str] = []

    def pump(stream):
        for line in stream:
            print(line.rstrip(), flush=True)
            tail.append(line)
            del tail[:-40]

    with open(out_path, "w") as out:
        proc = subprocess.Popen(cmd, cwd=APP_DIR, env=env, stdin=subprocess.DEVNULL, stdout=out,
                                stderr=subprocess.PIPE, text=True, bufsize=1)
        reader = threading.Thread(target=pump, args=(proc.stderr,), daemon=True)
        reader.start()
        try:
            code = proc.wait(timeout=timeout)
        except subprocess.TimeoutExpired:
            proc.kill()
            raise RuntimeError(f"komut {timeout} sn içinde bitmedi: {''.join(tail)[-1500:]}")
        reader.join(timeout=5)
    if code != 0:
        raise RuntimeError(f"komut başarısız ({code}): {''.join(tail)[-1500:]}")
    lines = open(out_path).read().strip().splitlines()
    if not lines:
        raise RuntimeError(f"komut çıktı vermedi: {''.join(tail)[-1500:]}")
    return lines[-1]


def handler(job):
    inp = job["input"]
    if inp.get("warmup"):
        return {"warm": True}
    parcel = inp.get("parcel")
    if not parcel:
        raise ValueError("input.parcel (GeoJSON veya KML metni) gerekli")

    work = tempfile.mkdtemp(prefix="drone-")
    src = os.path.join(work, "parcel.kml" if parcel.lstrip().startswith("<") else "parcel.geojson")
    with open(src, "w", encoding="utf-8") as f:
        f.write(parcel)
    env = {**os.environ, "CI": "1", "COREPACK_ENABLE_DOWNLOAD_PROMPT": "0"}
    if inp.get("gl_mode"):
        env["GL_MODE"] = inp["gl_mode"]  # egl | vulkan | swiftshader

    if inp.get("diagnose"):
        report = json.loads(run_streaming([*TSX, "scripts/diagnose.ts", "--in", src, "--out", work], env, 600))
        shot = report.pop("screenshot", None)
        if shot and os.path.exists(shot):
            with open(shot, "rb") as f:
                report["screenshot_base64"] = base64.b64encode(f.read()).decode()
        report["cpu_count_host"] = os.cpu_count()
        report["cpu_container"] = container_cpus()
        return report

    parallel = int(inp.get("parallel") or max(2, min(8, container_cpus() // 2)))
    cmd = [*TSX, "scripts/worker-render.ts", "--in", src, "--out", work,
           "--fps", str(inp.get("fps", 30)), "--parallel", str(parallel), "--crf", str(inp.get("crf", 22))]
    if inp.get("limit_frames"):
        cmd += ["--limit", str(inp["limit_frames"])]

    t0 = time.time()
    result = json.loads(run_streaming(cmd, env, 1500))

    prefix = inp.get("output_prefix", f"drone/{job['id']}")
    out = {
        "video": publish(result["video"], f"{prefix}/drone.mp4", "video/mp4"),
        "renderer": result["renderer"],
        "frames": result["frames"],
        "timeouts": result["timeouts"],
        "parcel": result["parcel"],
        "timings": {**result["seconds"], "handler_total": round(time.time() - t0, 1)},
        "parallel": parallel,
    }
    if os.path.exists(result["keyframeNeon"]):
        out["keyframe_neon"] = publish(to_jpeg(result["keyframeNeon"]), f"{prefix}/keyframe-neon.jpg", "image/jpeg")
        out["keyframe_clean"] = publish(to_jpeg(result["keyframeClean"]), f"{prefix}/keyframe-clean.jpg", "image/jpeg")
    return out


if __name__ == "__main__":
    runpod.serverless.start({"handler": handler})
