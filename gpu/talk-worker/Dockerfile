# Konuşan emlakçı worker'ı (InfiniteTalk) — temel model imajda DEĞİL: Wan2.1-I2V-14B-480P RunPod
# "cached models" önbelleğinden okunur. InfiniteTalk ses ağırlıkları, wav2vec ve hızlandırma LoRA'sı
# (~11 GB) ilk açılışta konteyner diskine indirilir (bkz. handler.py ensure_weights).
# Sürümler InfiniteTalk'un resmi kurulumuyla aynı: torch 2.4.1 + cu121, xformers 0.0.28, flash-attn 2.7.4.post1.
FROM pytorch/pytorch:2.4.1-cuda12.1-cudnn9-runtime

ENV PYTHONUNBUFFERED=1 \
    DEBIAN_FRONTEND=noninteractive \
    PIP_BREAK_SYSTEM_PACKAGES=1 \
    # xfuser/yunchang gibi paketler torch'u yükseltmeye kalkmasın.
    PIP_CONSTRAINT=/app/constraints.txt \
    HF_HUB_ENABLE_HF_TRANSFER=1

RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg git curl ca-certificates libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY constraints.txt requirements.txt ./
RUN pip install --no-cache-dir xformers==0.0.28 --index-url https://download.pytorch.org/whl/cu121
# Resmi flash-attn derlemesi (kaynaktan derleme saatler sürer); Python sürümüne göre seçilir.
RUN PY=$(python -c 'import sys; print(f"cp{sys.version_info.major}{sys.version_info.minor}")') \
    && pip install --no-cache-dir "https://github.com/Dao-AILab/flash-attention/releases/download/v2.7.4.post1/flash_attn-2.7.4.post1+cu12torch2.4cxx11abiFALSE-${PY}-${PY}-linux_x86_64.whl"
RUN pip install --no-cache-dir -r requirements.txt

# InfiniteTalk kodu sabit commit'ten (generate_infinitetalk.py'deki yardımcılar ve wan paketi kullanılır).
ARG INFINITETALK_COMMIT=50aa0a94184315407a991ae804d9b58d6d311ba8
RUN git clone https://github.com/MeiGen-AI/InfiniteTalk.git /app/infinitetalk \
    && git -C /app/infinitetalk checkout ${INFINITETALK_COMMIT} \
    && rm -rf /app/infinitetalk/.git /app/infinitetalk/examples /app/infinitetalk/assets

# Import denemesi: bağımlılık eksikse build burada düşsün, worker açılışında değil.
COPY handler.py .
RUN cd /app/infinitetalk && TALK_IMPORT_CHECK=1 python /app/handler.py

CMD ["python", "-u", "handler.py"]
