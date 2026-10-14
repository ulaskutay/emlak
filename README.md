# Arsa Video — Emlak için AI Video SaaS

Emlakçıların ilan fotoğrafı + konum/parsel bilgisinden çok sahneli tanıtım videosu (Reels 9:16, YouTube 16:9, ilan sitesi) ürettiği platform.

**Temel fikir:** GPU yalnızca 3–5 sn'lik sinematik sahnelerde (fotoğrafı hareketlendirme) kullanılır. Harita/parsel, bilgi kartları, logo, müzik ve seslendirme Remotion şablonlarıyla CPU'da üretilir. AI sahneleri **paralel** üretilir.

## Yapı

| Klasör | İçerik | Durum |
|---|---|---|
| `packages/shared` | Storyboard/ilan şeması (zod), sahne tipleri, emlak prompt'ları | ✅ |
| `packages/providers` | `VideoProvider` arayüzü: RunPod LTX + Seedance (premium) | ✅ |
| `gpu/ltx-worker` | RunPod Serverless worker (model imaja gömülü, sıcak süreç, R2'ye yükleme) | ✅ (Faz 0'da GPU üzerinde doğrulanacak) |
| `apps/orchestrator` | Mesai saati scaler'ı + benchmark aracı | ✅ (kuyruk/webhook Faz 2) |
| `apps/renderer` | Remotion şablonları | Faz 2 |
| `apps/web` | Next.js panel | Faz 3 |

## Hız stratejisi
1. **Cold start:** Model imajın içinde (`HF_HUB_OFFLINE=1`) + FlashBoot + mesai saatlerinde `workersMin=1` (`pnpm scaler`).
2. **Model yükleme:** `handler.py` modeli süreç açılışında bir kez yükler, işler sıcak süreçte işlenir.
3. **Üretim:** Distilled sigma takvimi (CFG yok, ~8 adım). Önizleme 448×768, final 704×1280.
4. **Panel:** Senkron bekleme yok. RunPod webhook + SSE (Faz 2–3).

## Faz 0 — Benchmark (ilk yapılacak iş)

### 1. Worker imajını derle ve yükle
```bash
cd gpu/ltx-worker
docker buildx build --platform linux/amd64 --secret id=hf_token,env=HF_TOKEN -t <dockerhub-kullanıcı>/arsa-ltx-worker:0.1 --push .
```

### 2. RunPod'da Serverless endpoint oluştur
- Container image: yukarıdaki imaj
- GPU: önce **H100 80GB**, sonra **L40S 48GB** (`CPU_OFFLOAD=1` ile) karşılaştırılacak
- FlashBoot: açık · Max workers: 8 · Idle timeout: 60 sn · Execution timeout: 600 sn
- Ortam değişkenleri: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_BASE_URL`

### 3. Ölç
```bash
cp .env.example .env   # RUNPOD_API_KEY ve RUNPOD_LTX_ENDPOINT_ID'yi doldurun
pnpm install
pnpm bench -- --runs 1                          # soğuk başlangıç (worker 0'dayken)
pnpm bench -- --runs 5                          # sıcak, art arda
pnpm bench -- --runs 5 --parallel 5             # 5 sahne paralel (gerçek proje senaryosu)
pnpm bench -- --runs 3 --quality final --format youtube_16x9
```
Sonuçlar `bench/results/` altına JSON olarak yazılır. **Hedef:** sıcak worker'da 5 sn'lik önizleme klibi < 40 sn.

### Faz 0'da doğrulanması gerekenler
- `LTX2ImageToVideoPipeline` + `Lightricks/LTX-2.5-Diffusers` + `DISTILLED_SIGMA_VALUES` kombinasyonu. Olmazsa `MODEL_ID` ve `USE_DISTILLED_SIGMAS=0` ile alternatifler denenir.
- Gerçek arsa fotoğraflarında halüsinasyon (bina/yol ekliyor mu?).
- İmaj boyutunun cold start'a etkisi. Çok büyükse RunPod "cached models" özelliği ile karşılaştırılır.
- Seedance API alan adları (`packages/providers/src/seedance.ts`).
- İki aşamalı (yarı çözünürlük + latent upsampler) final üretim: hız kazancı ölçülecek.

## Mesai saati scaler'ı
```bash
pnpm scaler            # tek seferlik (cron ile 10 dk'da bir)
pnpm scaler -- --loop  # süreç olarak
```
TR 08:00–22:00 arası `workersMin=1`, dışında 0. Yalnızca değer değişince güncelleme yapar (her güncelleme rolling release tetikler).
