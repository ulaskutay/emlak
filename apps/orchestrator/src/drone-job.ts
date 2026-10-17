/**
 * RunPod drone worker'ına parsel gönderir, videoyu ve son kareleri indirir.
 *
 *   pnpm drone-job -- --parcel assets/parcels/ezine-230-ada-3.geojson [--limit 60] [--fps 30] [--parallel 6]
 *
 * Çıktılar parsel klasörüne "runpod-" önekiyle yazılır (yerel kayıtlarla karışmasın).
 */
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, extname, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { RunpodClient } from "@arsa/providers";
import { requireEnv } from "./env.js";

const { values: args } = parseArgs({
  args: process.argv.slice(2).filter((a) => a !== "--"),
  options: {
    parcel: { type: "string" },
    limit: { type: "string" },
    fps: { type: "string" },
    parallel: { type: "string" },
    diagnose: { type: "boolean", default: false }, // worker ortam tanısı (WebGL, adım süreleri, ekran görüntüsü)
    "gl-mode": { type: "string" }, // egl | vulkan | swiftshader
    engine: { type: "string" }, // cesium | google
    msaa: { type: "string" },
  },
});
if (!args.parcel) throw new Error("--parcel assets/parcels/<dosya>.geojson gerekli");

const ROOT = resolve(import.meta.dirname, "../../..");
const outDir = join(ROOT, "assets/parcels", basename(args.parcel, extname(args.parcel)));
await mkdir(outDir, { recursive: true });

// Yerel önbellekteki çevre bilgisi işle gider: worker çevre sorgularını tekrarlamaz.
const contextFile = join(outDir, "context.json");
const context = existsSync(contextFile) ? JSON.parse(await readFile(contextFile, "utf8")) : undefined;

const client = new RunpodClient(requireEnv("RUNPOD_API_KEY"), requireEnv("RUNPOD_DRONE_ENDPOINT_ID"));
const t0 = Date.now();
const job = await client.run({
  parcel: await readFile(resolve(ROOT, args.parcel), "utf8"),
  ...(context ? { context } : {}),
  ...(args.limit ? { limit_frames: Number(args.limit) } : {}),
  ...(args.fps ? { fps: Number(args.fps) } : {}),
  ...(args.parallel ? { parallel: Number(args.parallel) } : {}),
  ...(args.diagnose ? { diagnose: true } : {}),
  ...(args["gl-mode"] ? { gl_mode: args["gl-mode"] } : {}),
  ...(args.engine ? { engine: args.engine } : {}),
  ...(args.msaa ? { msaa: Number(args.msaa) } : {}),
});
console.log(`Gönderildi: ${job.id}`);

const activeJob = job.id;
process.on("SIGINT", async () => {
  await client.cancel(activeJob).catch(() => {});
  process.exit(130);
});

let lastStatus = "";
let lastProgress = "";
for (;;) {
  await new Promise((r) => setTimeout(r, 4000));
  const s = await client.status(job.id);
  if (s.status !== lastStatus) {
    console.log(`${((Date.now() - t0) / 1000).toFixed(0)} sn: ${s.status}`);
    lastStatus = s.status;
  }
  // Worker'ın canlı ilerlemesi (progress_update): yalnızca yeni satırlar.
  const progress = s.output as unknown;
  if (s.status === "IN_PROGRESS" && typeof progress === "string" && progress !== lastProgress) {
    const prev = new Set(lastProgress.split("\n"));
    for (const line of progress.split("\n")) if (line.trim() && !prev.has(line)) console.log(`  │ ${line}`);
    lastProgress = progress;
  }
  if (s.status === "COMPLETED" && args.diagnose) {
    const out = { ...(s.output as Record<string, any>) };
    if (out.screenshot_base64) {
      await writeFile(join(outDir, "runpod-diag.jpg"), Buffer.from(out.screenshot_base64, "base64"));
      out.screenshot_base64 = `→ ${join(outDir, "runpod-diag.jpg")}`;
    }
    console.log(JSON.stringify(out, null, 2));
    break;
  }
  if (s.status === "COMPLETED") {
    const out = s.output as Record<string, any>;
    const save = async (name: string, item?: { url?: string; base64?: string }) => {
      if (!item) return;
      if (item.base64) await writeFile(join(outDir, name), Buffer.from(item.base64, "base64"));
      else if (item.url) await writeFile(join(outDir, name), Buffer.from(await (await fetch(item.url)).arrayBuffer()));
      console.log(`  ${name}: ${join(outDir, name)}${item.url ? `\n    R2: ${item.url.split("?")[0]}` : ""}`);
    };
    await save("runpod-drone.mp4", out.video);
    await save("runpod-keyframe-neon.jpg", out.keyframe_neon);
    await save("runpod-keyframe-clean.jpg", out.keyframe_clean);
    if (out.errors?.length) console.log(`Sayfa hataları:\n  ${out.errors.join("\n  ")}`);
    console.log(`WebGL: ${out.renderer} · paralel ${out.parallel} · ${out.frames} kare · ${out.timeouts} zaman aşımı`);
    console.log(`Süreler: ${JSON.stringify(out.timings)} · kuyruk ${((s.delayTime ?? 0) / 1000).toFixed(0)} sn, çalışma ${((s.executionTime ?? 0) / 1000).toFixed(0)} sn`);
    break;
  }
  if (["FAILED", "CANCELLED", "TIMED_OUT"].includes(s.status)) {
    console.error(`HATA: ${s.error ?? JSON.stringify(s.output)}`.slice(0, 2000));
    process.exit(1);
  }
}
