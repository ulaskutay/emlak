# Arsa Video — Emlak için AI Video SaaS

Emlakçıların ilan fotoğrafı + konum/parsel bilgisinden çok sahneli tanıtım videosu (Reels 9:16, YouTube 16:9, ilan sitesi) ürettiği platform.

**Temel fikir:** GPU yalnızca 3–5 sn'lik sinematik sahnelerde (fotoğrafı hareketlendirme) kullanılır. Harita/parsel, bilgi kartları, logo, müzik ve seslendirme Remotion şablonlarıyla CPU'da üretilir. AI sahneleri **paralel** üretilir.

## Yapı

| Klasör | İçerik | Durum |
|---|---|---|
| `packages/shared` | Storyboard/ilan şeması (zod), sahne tipleri, emlak prompt'ları | ✅ |
| `packages/providers` | `VideoProvider` arayüzü: RunPod LTX + Seedance (premium) | ✅ |
| `gpu/video-worker` | RunPod Serverless worker: Hunyuan 1.5 / LTX-2, model RunPod önbelleğinden, sıcak süreç, adım adım süre logu | ✅ (GPU'da doğrulanacak) |
| `apps/orchestrator` | Mesai saati scaler'ı + benchmark aracı | ✅ (kuyruk/webhook Faz 2) |
| `apps/renderer` | Remotion şablonları | Faz 2 |
| `apps/web` | Next.js panel | Faz 3 |

## Hız stratejisi
1. **Model indirme yok:** Ağırlıklar RunPod **cached models** önbelleğinden okunur (`/runpod-volume/huggingface-cache`). İndirme süresi faturalanmaz, imaj küçük kalır.
2. **Model bir kez yüklenir:** `handler.py` modeli süreç açılışında GPU'ya yükler, işler sıcak süreçte işlenir. Açılışın her adımı süresiyle loglanır.
3. **Worker kapanmaz:** Idle timeout 60 sn + FlashBoot + mesai saatlerinde `workersMin=1` (`pnpm scaler`).
4. **Ucuz GPU:** Varsayılan model HunyuanVideo 1.5 480p step-distilled (8B), 48 GB GPU'ya ($1.22/saat, bol arz) sığar.
5. **Panel beklemez:** RunPod webhook + SSE (Faz 2–3).

> **Ders (2026-10-14):** RunPod'un hazır vLLM-Omni endpoint'i (Hunyuan 1.5) ilk testte 19 dk çıktı vermeden çalıştı ve log üretmedi. Kara kutu worker'ı bırakıp kendi worker'ımıza geçtik.

## Faz 0 — Benchmark

### 1. RunPod'da endpoint oluştur (GitHub'dan)
Serverless → New Endpoint → **Deploy from a GitHub repository** → `ulaskutay/emlak`
- Branch `main`, Dockerfile `gpu/video-worker/Dockerfile`, build context `gpu/video-worker`
- **Model alanı:** `hunyuanvideo-community/HunyuanVideo-1.5-Diffusers-480p_i2v_step_distilled` (cached models'i açar)
- GPU: 48 GB (1.), 48 GB PRO (2.) — A40/A6000 gibi eski kartlar yavaş, mümkünse L40S/Ada tercih edin
- Active workers 0 · Max workers 3 · Idle timeout 60 sn · FlashBoot açık · Execution timeout 600 sn
- Ortam değişkenleri: `MODEL_FAMILY=hunyuan15` (+ R2 kurulunca `R2_*`; kurulmadan video base64 döner)

> **Önemli:** GitHub → Settings → Applications → **Runpod Inc.** → Repository access listesinde `ulaskutay/emlak` olmalı. Yoksa RunPod sadece ilk build'i yapar; sonraki push'lar build başlatmaz.
> `.github/workflows/worker-release.yml` ayrıca worker kodu değişince otomatik release açar.

### 2. Ölç
`.env` içinde `RUNPOD_API_KEY` ve `RUNPOD_VIDEO_ENDPOINT_ID`'yi doldurun, sonra:
```bash
pnpm bench -- --runs 1 --format youtube_16x9          # soğuk başlangıç
pnpm bench -- --runs 3 --format youtube_16x9          # sıcak, art arda
pnpm bench -- --runs 3 --parallel 3                   # 3 sahne paralel
```
Sonuçlar ve videolar `bench/results/` altına yazılır. Açılış adımlarının süreleri endpoint loglarında `[worker +…s]` satırlarındadır.

### Doğrulanacaklar
- Worker loglarında "model önbellekte bulundu" satırı (görünmüyorsa Model alanı yanlış).
- 48 GB'da `CPU_OFFLOAD=0` ile bellek yetiyor mu? Yetmezse `CPU_OFFLOAD=1`.
- Arsa fotoğraflarında halüsinasyon (bina/yol ekliyor mu?).
- LTX-2 (`MODEL_FAMILY=ltx2`, 80 GB) ile kalite/hız karşılaştırması.
- Seedance API alan adları (`packages/providers/src/seedance.ts`).

## Mesai saati scaler'ı
```bash
pnpm scaler            # tek seferlik (cron ile 10 dk'da bir)
pnpm scaler -- --loop  # süreç olarak
```
TR 08:00–22:00 arası `workersMin=1`, dışında 0. Yalnızca değer değişince güncelleme yapar (her güncelleme rolling release tetikler).
