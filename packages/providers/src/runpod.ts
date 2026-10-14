import { buildRealEstatePrompt, type OutputFormat, type RenderQuality } from "@arsa/shared";
import { framesFor, type JobState, type JobStatus, type SubmittedJob, type VideoJobInput, type VideoProvider } from "./types.js";

const RUNPOD_API = "https://api.runpod.ai/v2";
const RUNPOD_REST = "https://rest.runpod.io/v1";
const FPS = 24;

/**
 * AI klip çözünürlükleri (64'e bölünebilir).
 * Final klip Remotion'da hedef formata (1080x1920 / 1920x1080) ölçeklenir.
 */
const CLIP_SIZES: Record<RenderQuality, Record<"portrait" | "landscape", { width: number; height: number }>> = {
  preview: { portrait: { width: 448, height: 768 }, landscape: { width: 768, height: 448 } },
  final: { portrait: { width: 704, height: 1280 }, landscape: { width: 1280, height: 704 } },
};

export function clipSize(format: OutputFormat, quality: RenderQuality) {
  return CLIP_SIZES[quality][format === "reels_9x16" ? "portrait" : "landscape"];
}

/** RunPod worker'ının beklediği input (gpu/ltx-worker/handler.py ile birebir aynı tutulmalı). */
export interface LtxWorkerInput {
  image_url: string;
  prompt: string;
  negative_prompt: string;
  width: number;
  height: number;
  num_frames: number;
  frame_rate: number;
  seed: number;
  output_key: string;
}

const STATE_MAP: Record<string, JobState> = {
  IN_QUEUE: "queued",
  IN_PROGRESS: "running",
  COMPLETED: "completed",
  FAILED: "failed",
  CANCELLED: "failed",
  TIMED_OUT: "failed",
};

export class RunpodClient {
  constructor(
    private readonly apiKey: string,
    readonly endpointId: string,
  ) {}

  private async request<T>(url: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(url, {
      ...init,
      headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json", ...init.headers },
    });
    if (!res.ok) throw new Error(`RunPod ${init.method ?? "GET"} ${url} → ${res.status}: ${await res.text()}`);
    return (await res.json()) as T;
  }

  run(input: unknown, webhook?: string) {
    return this.request<{ id: string; status: string }>(`${RUNPOD_API}/${this.endpointId}/run`, {
      method: "POST",
      body: JSON.stringify({ input, ...(webhook ? { webhook } : {}) }),
    });
  }

  status(jobId: string) {
    return this.request<{
      id: string;
      status: string;
      output?: { video_url?: string; error?: string; timings?: Record<string, number> };
      error?: string;
      delayTime?: number;
      executionTime?: number;
    }>(`${RUNPOD_API}/${this.endpointId}/status/${jobId}`);
  }

  health() {
    return this.request<{ jobs: Record<string, number>; workers: Record<string, number> }>(
      `${RUNPOD_API}/${this.endpointId}/health`,
    );
  }

  /** Endpoint ayarlarını günceller (ör. mesai saatlerinde workersMin=1). Rolling release tetikler. */
  updateEndpoint(patch: { workersMin?: number; workersMax?: number; idleTimeout?: number; flashboot?: boolean }) {
    return this.request<{ id: string; workersMin: number; workersMax: number }>(
      `${RUNPOD_REST}/endpoints/${this.endpointId}/update`,
      { method: "POST", body: JSON.stringify(patch) },
    );
  }

  /** Worker'ı önden ısıtmak için boş iş (handler model yükleyip hemen döner). */
  warmup() {
    return this.run({ warmup: true });
  }
}

export class RunpodLtxProvider implements VideoProvider {
  readonly id = "runpod_ltx" as const;

  constructor(private readonly client: RunpodClient) {}

  buildInput(input: VideoJobInput): LtxWorkerInput {
    const { width, height } = clipSize(input.format, input.quality);
    const { prompt, negativePrompt } = buildRealEstatePrompt(input.scene);
    return {
      image_url: input.scene.photoUrl,
      prompt,
      negative_prompt: negativePrompt,
      width,
      height,
      num_frames: framesFor(input.scene.durationSec, FPS),
      frame_rate: FPS,
      seed: input.seed ?? 42,
      output_key: `projects/${input.projectId}/scenes/${input.scene.id}-${input.quality}.mp4`,
    };
  }

  async submit(input: VideoJobInput, opts?: { webhookUrl?: string }): Promise<SubmittedJob> {
    const job = await this.client.run(this.buildInput(input), opts?.webhookUrl);
    return { provider: this.id, externalId: job.id };
  }

  async getStatus(externalId: string): Promise<JobStatus> {
    const s = await this.client.status(externalId);
    return {
      state: STATE_MAP[s.status] ?? "queued",
      videoUrl: s.output?.video_url,
      error: s.error ?? s.output?.error,
      delayMs: s.delayTime,
      executionMs: s.executionTime,
    };
  }
}

export interface RunpodEndpointInfo {
  id: string;
  workersMin: number;
  workersMax: number;
  idleTimeout: number;
  flashboot: boolean;
}

export function getEndpoint(client: RunpodClient, apiKey: string): Promise<RunpodEndpointInfo> {
  return fetch(`${RUNPOD_REST}/endpoints/${client.endpointId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  }).then(async (r) => {
    if (!r.ok) throw new Error(`RunPod GET endpoint → ${r.status}: ${await r.text()}`);
    return (await r.json()) as RunpodEndpointInfo;
  });
}
