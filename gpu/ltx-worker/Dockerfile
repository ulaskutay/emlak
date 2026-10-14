# LTX-2 RunPod Serverless worker — model ağırlıkları imajın İÇİNDE (açılışta indirme yok).
FROM pytorch/pytorch:2.8.0-cuda12.8-cudnn9-runtime

ENV PYTHONUNBUFFERED=1 \
    HF_HOME=/models \
    HF_HUB_ENABLE_HF_TRANSFER=1 \
    DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Modeli build sırasında indir. HF token build secret olarak verilir, imaja yazılmaz:
#   docker build --secret id=hf_token,env=HF_TOKEN --build-arg MODEL_ID=... -t arsa/ltx-worker .
ARG MODEL_ID=Lightricks/LTX-2.5-Diffusers
ENV MODEL_ID=${MODEL_ID}
RUN --mount=type=secret,id=hf_token \
    HF_TOKEN=$(cat /run/secrets/hf_token 2>/dev/null || true) \
    python -c "import os; from huggingface_hub import snapshot_download; snapshot_download(os.environ['MODEL_ID'], token=os.environ.get('HF_TOKEN') or None)"

# Runtime'da internetten model çekmeye çalışmasın.
ENV HF_HUB_OFFLINE=1

COPY handler.py .
CMD ["python", "-u", "handler.py"]
