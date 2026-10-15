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
       google-chrome-stable ffmpeg libvulkan1 mesa-vulkan-drivers \
       fonts-noto-color-emoji fonts-noto-core fonts-dejavu-core \
       python3 python3-pip \
    && rm -rf /var/lib/apt/lists/*

RUN pip3 install --no-cache-dir runpod==1.7.13 boto3 && corepack enable

WORKDIR /app
# Bağımlılıklar önce (katman önbelleği), sonra kaynak
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/geo/package.json packages/geo/
COPY apps/drone-studio/package.json apps/drone-studio/
RUN pnpm install --frozen-lockfile --filter @arsa/drone-studio...

COPY packages/geo packages/geo
COPY apps/drone-studio apps/drone-studio
COPY gpu/drone-worker/handler.py /app/handler.py

CMD ["python3", "-u", "/app/handler.py"]
