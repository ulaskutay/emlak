import type { AiScene, OutputFormat, RenderQuality } from "@arsa/shared";

export type ProviderId = "runpod_video" | "seedance";

export interface VideoJobInput {
  projectId: string;
  scene: AiScene;
  format: OutputFormat;
  quality: RenderQuality;
  seed?: number;
  /** Difüzyon adım sayısı; verilmezse profil varsayılanı (DEFAULT_STEPS). */
  numSteps?: number;
  /** Real-ESRGAN ile hedef formata (ör. 1080x1920) büyüt. Varsayılan true. */
  upscale?: boolean;
}

export interface SubmittedJob {
  provider: ProviderId;
  externalId: string;
}

export type JobState = "queued" | "running" | "completed" | "failed";

export interface JobStatus {
  state: JobState;
  /** Tamamlandığında video URL'i. Seedance URL'leri süreli, orkestratör R2'ye kopyalamalı. */
  videoUrl?: string;
  error?: string;
  /** Maliyet takibi için: kuyrukta bekleme ve GPU'da çalışma süresi (ms). */
  delayMs?: number;
  executionMs?: number;
}

/** Tak-çıkar video modeli arayüzü. Paket bazında provider seçilir (Standart = RunPod açık model, Premium = Seedance). */
export interface VideoProvider {
  readonly id: ProviderId;
  submit(input: VideoJobInput, opts?: { webhookUrl?: string }): Promise<SubmittedJob>;
  getStatus(externalId: string): Promise<JobStatus>;
}

/** Sahne süresini modelin kare ızgarasına (8k+1) oturtur. */
export function framesFor(durationSec: number, fps: number): number {
  const raw = Math.round(durationSec * fps);
  return Math.max(9, Math.round((raw - 1) / 8) * 8 + 1);
}
