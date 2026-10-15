import { REEL_STAGES, type ReelStage, type ReelStatus } from "@arsa/shared";

export function statusLabel(status: ReelStatus, stage?: ReelStage | null) {
  if (status === "done") return "Hazır";
  if (status === "failed") return "Hata";
  if (status === "queued") return "Sırada";
  return REEL_STAGES.find((s) => s.id === stage)?.label ?? "Hazırlanıyor";
}

export const statusTone: Record<ReelStatus, string> = {
  done: "bg-emerald-400/15 text-emerald-300",
  failed: "bg-red-500/15 text-red-300",
  queued: "bg-white/10 text-mute",
  running: "bg-neon/15 text-neon",
};

/** Genel ilerleme (0..1): aşama sırası + aşama içi ilerleme. Render en uzun aşama, ağırlığı büyük. */
const WEIGHTS: Record<ReelStage, [number, number]> = {
  parcel: [0, 0.08],
  script: [0.08, 0.1],
  voice: [0.1, 0.2],
  render: [0.2, 0.9],
  mix: [0.9, 0.99],
  done: [1, 1],
};
export function overallProgress(status: ReelStatus, stage: ReelStage | null | undefined, progress: number) {
  if (status === "done") return 1;
  if (!stage) return 0;
  const [a, b] = WEIGHTS[stage];
  return a + (b - a) * Math.max(0, Math.min(1, progress));
}
