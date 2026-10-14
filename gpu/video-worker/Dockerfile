# Video worker — model imajda DEĞİL: RunPod "cached models" önbelleğinden okunur
# (/runpod-volume/huggingface-cache). İmaj küçük kalır, worker hızlı açılır.
FROM pytorch/pytorch:2.8.0-cuda12.8-cudnn9-runtime

ENV PYTHONUNBUFFERED=1 \
    DEBIAN_FRONTEND=noninteractive \
    HF_HUB_OFFLINE=1

RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY handler.py .
CMD ["python", "-u", "handler.py"]
