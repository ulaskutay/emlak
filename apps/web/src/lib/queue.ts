import "server-only";
import { Queue } from "bullmq";

/** Panel → worker: video üretim kuyruğu (apps/worker aynı adı dinler). */
export const REEL_QUEUE = "reel";

const g = globalThis as unknown as { __reelQueue?: Queue };

function redisConnection() {
  const u = new URL(process.env.REDIS_URL ?? "redis://localhost:6379");
  return { host: u.hostname, port: Number(u.port || 6379), username: u.username || undefined, password: u.password || undefined };
}

export function reelQueue() {
  g.__reelQueue ??= new Queue(REEL_QUEUE, { connection: redisConnection() });
  return g.__reelQueue;
}

export async function enqueueReel(videoId: string) {
  // jobId = videoId: aynı video iki kez kuyruğa girmez.
  await reelQueue().add("reel", { videoId }, { jobId: `${videoId}-${Date.now()}`, removeOnComplete: 500, removeOnFail: 500 });
}
