import { TEMPLATES, type ReelStatus, type TemplateId } from "@arsa/shared";

const stagesOf = (template: TemplateId) => TEMPLATES[template]?.stages ?? TEMPLATES["arsa-drone"].stages;

export function statusLabel(status: ReelStatus, stage: string | null | undefined, template: TemplateId = "arsa-drone") {
  if (status === "done") return "Hazır";
  if (status === "failed") return "Hata";
  if (status === "queued") return "Sırada";
  return stagesOf(template).find((s) => s.id === stage)?.label ?? "Hazırlanıyor";
}

export const statusTone: Record<ReelStatus, string> = {
  done: "bg-emerald-400/15 text-emerald-300",
  failed: "bg-red-500/15 text-red-300",
  queued: "bg-white/10 text-mute",
  running: "bg-neon/15 text-neon",
};

/** Aşamaların genel ilerlemedeki payı (0..1 aralıkları). Uzun süren GPU aşamalarının payı büyük. */
const WEIGHTS: Partial<Record<TemplateId, Record<string, [number, number]>>> = {
  "arsa-drone": { parcel: [0, 0.08], script: [0.08, 0.1], voice: [0.1, 0.2], render: [0.2, 0.9], mix: [0.9, 0.99], done: [1, 1] },
  "ilan-videosu": { photos: [0, 0.03], clips: [0.03, 0.85], music: [0.85, 0.92], compose: [0.92, 0.99], done: [1, 1] },
  "bitmis-hali": { parcel: [0, 0.05], render: [0.05, 0.5], build: [0.5, 0.6], timelapse: [0.6, 0.93], compose: [0.93, 0.99], done: [1, 1] },
  "insaat-videosu": { parcel: [0, 0.02], side: [0.02, 0.12], build: [0.12, 0.3], timelapse: [0.3, 0.85], compose: [0.85, 0.93], sound: [0.93, 0.99], done: [1, 1] },
  "dosenmis-ev": { photos: [0, 0.03], staging: [0.03, 0.3], clips: [0.3, 0.93], compose: [0.93, 0.99], done: [1, 1] },
  "sunucu-ev": { photos: [0, 0.02], staging: [0.02, 0.15], presenter: [0.15, 0.3], clips: [0.3, 0.93], compose: [0.93, 0.99], done: [1, 1] },
};

/** Genel ilerleme (0..1): aşama sırası + aşama içi ilerleme. */
export function overallProgress(status: ReelStatus, stage: string | null | undefined, progress: number, template: TemplateId = "arsa-drone") {
  if (status === "done") return 1;
  if (!stage) return 0;
  const w = WEIGHTS[template]?.[stage];
  if (!w) return 0;
  const [a, b] = w;
  return a + (b - a) * Math.max(0, Math.min(1, progress));
}

/** Liste ve detayda video başlığı. */
export function videoTitle(v: {
  template: TemplateId;
  parcelSummary: { ada?: string; parsel?: string; nitelik?: string } | null;
  input: unknown;
}) {
  if (v.template === "ilan-videosu") {
    const n = (v.input as { photos?: unknown[] }).photos?.length ?? 0;
    return `İlan videosu · ${n} fotoğraf`;
  }
  if (v.template === "dosenmis-ev") {
    const n = (v.input as { photos?: unknown[] }).photos?.length ?? 0;
    return `Boş evi döşe · ${n} oda`;
  }
  if (v.template === "sunucu-ev") {
    const n = (v.input as { photos?: unknown[] }).photos?.length ?? 0;
    return `Sunuculu ev turu · ${n} oda`;
  }
  const s = v.parcelSummary;
  const parcel = s?.ada && s.parsel ? `${s.ada} ada ${s.parsel} parsel` : "Parsel";
  if (v.template === "insaat-videosu") return `${parcel} · inşaat videosu`;
  return v.template === "bitmis-hali" ? `${parcel} · bitmiş hali` : [parcel, s?.nitelik].filter(Boolean).join(" · ");
}
