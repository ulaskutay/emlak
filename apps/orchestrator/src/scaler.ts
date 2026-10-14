/**
 * Mesai saati scaler'ı: TR mesai saatlerinde 1 sıcak worker tutar, gece sıfıra indirir.
 * Cold start sorununun ana çözümü budur. Cron ile 10-15 dakikada bir çalıştırılır
 * (veya `--loop` ile süreç olarak). Yalnızca değer değişince günceller, çünkü her güncelleme
 * RunPod'da rolling release tetikler.
 */
import { getEndpoint, RunpodClient } from "@arsa/providers";
import { intEnv, requireEnv } from "./env.js";

export function hourIn(timeZone: string, date = new Date()): number {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone, hour: "numeric", hourCycle: "h23" }).format(date));
}

export function desiredActiveWorkers(hour: number, cfg = scalerConfig()): number {
  const working = hour >= cfg.start && hour < cfg.end;
  return working ? cfg.dayWorkers : cfg.nightWorkers;
}

function scalerConfig() {
  return {
    timeZone: process.env.SCALER_TIMEZONE ?? "Europe/Istanbul",
    start: intEnv("SCALER_WORK_START", 8),
    end: intEnv("SCALER_WORK_END", 22),
    dayWorkers: intEnv("SCALER_ACTIVE_WORKERS_DAY", 1),
    nightWorkers: intEnv("SCALER_ACTIVE_WORKERS_NIGHT", 0),
    maxWorkers: intEnv("SCALER_MAX_WORKERS", 8),
  };
}

export async function reconcile(): Promise<void> {
  const apiKey = requireEnv("RUNPOD_API_KEY");
  const client = new RunpodClient(apiKey, requireEnv("RUNPOD_VIDEO_ENDPOINT_ID"));
  const cfg = scalerConfig();
  const hour = hourIn(cfg.timeZone);
  const want = desiredActiveWorkers(hour, cfg);

  const current = await getEndpoint(client, apiKey);
  const needsUpdate = current.workersMin !== want || current.workersMax !== cfg.maxWorkers || !current.flashboot;
  if (!needsUpdate) {
    console.log(`[scaler] saat ${hour}: workersMin=${want} zaten doğru, değişiklik yok`);
    return;
  }
  await client.updateEndpoint({ workersMin: want, workersMax: cfg.maxWorkers, flashboot: true });
  console.log(`[scaler] saat ${hour}: workersMin ${current.workersMin} → ${want}, workersMax=${cfg.maxWorkers}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const loop = process.argv.includes("--loop");
  const tick = () => reconcile().catch((e) => console.error("[scaler] hata:", e));
  await tick();
  if (loop) setInterval(tick, 10 * 60 * 1000);
}
