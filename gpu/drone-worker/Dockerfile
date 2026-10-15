# Drone worker — Google 3D harita (Maps JS) + Playwright + görünmez Chrome + ffmpeg.
# Build context: depo kökü (packages/geo ve apps/drone-studio gerekir).
#   RunPod: Dockerfile yolu gpu/drone-worker/Dockerfile, build context "."
FROM node:22-bookworm

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    PIP_BREAK_SYSTEM_PACKAGES=1 \
    # Chrome'un NVIDIA GPU'yu Vulkan üzerinden kullanabilmesi için grafik yetenekleri de açılmalı
    NVIDIA_DRIVER_CAPABILITIES=all \
    NVIDIA_VISIBLE_DEVICES=all

# Google Chrome (resmî apt deposu), ffmpeg, Vulkan yükleyici, Türkçe/emoji fontları, Python (RunPod SDK)
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl gnupg \
    && curl -fsSL https://dl.google.com/linux/linux_signing_key.pub | gpg --dearmor -o /usr/share/keyrings/google-chrome.gpg \
    && echo "deb [arch=amd64 signed-by=/usr/share/keyrings/google-chrome.gpg] http://dl.google.com/linux/chrome/deb/ stable main" \
       > /etc/apt/sources.list.d/google-chrome.list \
    && apt-get update && apt-get install -y --no-install-recommends \
       google-chrome-stable ffmpeg libvulkan1 libegl1 libgl1 libglvnd0 vulkan-tools \
       fonts-noto-color-emoji fonts-noto-core fonts-dejavu-core \
       python3 python3-pip \
    && rm -rf /var/lib/apt/lists/*

# NVIDIA sürücü kütüphanelerini (libEGL_nvidia, libGLX_nvidia) konteyner araç seti bağlar, ama yükleyicilerin
# onları bulması için tanım dosyaları gerekir; yoksa Chrome sessizce SwiftShader'a (işlemci) düşer.
RUN mkdir -p /usr/share/vulkan/icd.d /usr/share/glvnd/egl_vendor.d \
    && echo '{"file_format_version":"1.0.0","ICD":{"library_path":"libGLX_nvidia.so.0","api_version":"1.3"}}' \
       > /usr/share/vulkan/icd.d/nvidia_icd.json \
    && echo '{"file_format_version":"1.0.0","ICD":{"library_path":"libEGL_nvidia.so.0"}}' \
       > /usr/share/glvnd/egl_vendor.d/10_nvidia.json

RUN pip3 install --no-cache-dir runpod==1.7.13 boto3 && corepack enable

WORKDIR /app
# Bağımlılıklar önce (katman önbelleği), sonra kaynak
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/geo/package.json packages/geo/
COPY packages/providers/package.json packages/providers/
COPY packages/shared/package.json packages/shared/
COPY apps/drone-studio/package.json apps/drone-studio/
RUN pnpm install --frozen-lockfile --filter @arsa/drone-studio...

COPY packages/geo packages/geo
COPY packages/providers packages/providers
COPY packages/shared packages/shared
COPY apps/drone-studio apps/drone-studio
COPY gpu/drone-worker/handler.py /app/handler.py

CMD ["python3", "-u", "/app/handler.py"]
