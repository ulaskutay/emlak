# Video worker — model imajda DEĞİL: RunPod "cached models" önbelleğinden okunur
# (/runpod-volume/huggingface-cache). İmaj küçük kalır, worker hızlı açılır.
# torch 2.11: SageAttention hub kernel v2'nin CUDA 12.8 derlemesi bu sürümden başlıyor.
FROM pytorch/pytorch:2.11.0-cuda12.8-cudnn9-runtime

ENV PYTHONUNBUFFERED=1 \
    DEBIAN_FRONTEND=noninteractive \
    # torch 2.11 imajı Python'u PEP 668 ile "harici yönetilen" işaretliyor; container içinde pip'e izin ver.
    PIP_BREAK_SYSTEM_PACKAGES=1 \
    # SageAttention kernel'i HF hub'dan (kernels-community) gelir; diffusers'ın uzak kernel güvenlik
    # kontrolü için açık izin. Kernel build sırasında indirilir, çalışma anında internet gerekmez.
    DIFFUSERS_TRUST_REMOTE_KERNELS=true

RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# SageAttention hub kernel v2'yi (torch211-cu128 derlemesi) imaja önceden indir.
# Başarısız olursa build durmaz; worker açılışta indirmeyi dener, olmazsa native SDPA'ya düşer.
RUN python -c "from kernels import get_kernel; get_kernel('SageAttention/sage-attention', version=2, trust_remote_code=True, check_arch=False); print('sage kernel hazır')" \
    || echo "UYARI: sage kernel build sırasında indirilemedi"

COPY handler.py .
CMD ["python", "-u", "handler.py"]
