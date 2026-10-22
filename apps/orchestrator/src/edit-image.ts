/**
 * Tek görseli Qwen-Image-Edit ile düzenler (RunPod). İnşaat videosunun kare zincirini denemek için.
 *
 *   pnpm edit-image -- --in <girdi.png> --out <çıktı.png> --prompt "..." [--seed 7] [--steps 40]
 */
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { RunpodClient } from "@arsa/providers";
import { requireEnv } from "./env.js";

const { values: args } = parseArgs({
  args: process.argv.slice(2).filter((a) => a !== "--"),
  options: {
    in: { type: "string" },
    out: { type: "string" },
    prompt: { type: "string" },
    seed: { type: "string", default: "7" },
    steps: { type: "string", default: "40" },
    width: { type: "string", default: "1080" },
    height: { type: "string", default: "1920" },
  },
});
if (!args.in || !args.out || !args.prompt) throw new Error("--in, --out ve --prompt gerekli");

const ROOT = resolve(import.meta.dirname, "../../..");
const client = new RunpodClient(requireEnv("RUNPOD_API_KEY"), requireEnv("RUNPOD_QWEN_ENDPOINT_ID"));
const t0 = Date.now();
const job = await client.run({
  image_url: `data:image/png;base64,${(await readFile(resolve(ROOT, args.in))).toString("base64")}`,
  width: Number(args.width),
  height: Number(args.height),
  prompt: args.prompt,
  seed: Number(args.seed),
  num_steps: Number(args.steps),
});
console.log(`gönderildi: ${job.id}`);
for (;;) {
  await new Promise((r) => setTimeout(r, 3000));
  const s = await client.status(job.id);
  if (s.status === "COMPLETED") {
    const out = s.output as Record<string, any>;
    await writeFile(resolve(ROOT, args.out), Buffer.from(out.image_base64, "base64"));
    console.log(`tamam: ${((Date.now() - t0) / 1000).toFixed(0)} sn (gpu ${out.timings?.generate_seconds} sn) → ${args.out}`);
    break;
  }
  if (["FAILED", "CANCELLED", "TIMED_OUT"].includes(s.status)) throw new Error(`${s.status}: ${s.error ?? s.output?.error ?? ""}`);
}
