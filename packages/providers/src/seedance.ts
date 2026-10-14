import { buildRealEstatePrompt } from "@arsa/shared";
import type { JobState, JobStatus, SubmittedJob, VideoJobInput, VideoProvider } from "./types.js";

/**
 * Seedance (BytePlus ModelArk) — premium paket.
 * Not: İstek/yanıt alanları Faz 0'da gerçek API anahtarıyla doğrulanmalı.
 * Dönen video URL'i süreli olduğundan orkestratör sonucu R2'ye kopyalamalı.
 */
export class SeedanceProvider implements VideoProvider {
  readonly id = "seedance" as const;

  constructor(
    private readonly apiKey: string,
    private readonly model: string,
    private readonly baseUrl = "https://ark.ap-southeast.bytepluses.com/api/v3",
  ) {}

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
    });
    if (!res.ok) throw new Error(`Seedance ${path} → ${res.status}: ${await res.text()}`);
    return (await res.json()) as T;
  }

  async submit(input: VideoJobInput, opts?: { webhookUrl?: string }): Promise<SubmittedJob> {
    const { prompt } = buildRealEstatePrompt(input.scene);
    const resolution = input.quality === "final" ? "1080p" : "480p";
    const ratio = input.format === "reels_9x16" ? "9:16" : "16:9";
    const duration = input.scene.durationSec <= 5 ? 5 : 10;
    const task = await this.request<{ id: string }>("/contents/generations/tasks", {
      method: "POST",
      body: JSON.stringify({
        model: this.model,
        content: [
          { type: "text", text: `${prompt} --resolution ${resolution} --ratio ${ratio} --duration ${duration}` },
          { type: "image_url", image_url: { url: input.scene.photoUrl } },
        ],
        ...(opts?.webhookUrl ? { callback_url: opts.webhookUrl } : {}),
      }),
    });
    return { provider: this.id, externalId: task.id };
  }

  async getStatus(externalId: string): Promise<JobStatus> {
    const t = await this.request<{ status: string; content?: { video_url?: string }; error?: { message?: string } }>(
      `/contents/generations/tasks/${externalId}`,
    );
    const map: Record<string, JobState> = {
      queued: "queued",
      running: "running",
      succeeded: "completed",
      failed: "failed",
      cancelled: "failed",
    };
    return { state: map[t.status] ?? "queued", videoUrl: t.content?.video_url, error: t.error?.message };
  }
}
