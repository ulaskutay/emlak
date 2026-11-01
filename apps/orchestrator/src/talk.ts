/**
 * Konuşan emlakçı denemesi: fotoğraf + seslendirme → InfiniteTalk (RunPod) → dudakları sese oturan video.
 *
 *   pnpm talk -- --image <oda.png> --audio <ses.mp3> --out <video.mp4> [--prompt "..."] [--resolution 480] [--steps 4]
 */
import { readFile, writeFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { parseArgs } from "node:util";
import { RunpodClient, type TalkWorkerInput } from "@arsa/providers";
import { requireEnv } from "./env.js";

const { values: args } = parseArgs({
  args: process.argv.slice(2).filter((a) => a !== "--"),
  options: {
    image: { type: "string" },
    audio: { type: "string" },
    out: { type: "string" },
    prompt: {
      type: "string",
      default:
        "A friendly professional female real estate agent stands in a bright furnished living room and talks to the camera, " +
        "explaining the room with natural facial expressions, subtle head movements and small hand gestures. Static camera.",
    },
    resolution: { type: "string", default: "480" },
    steps: { type: "string", default: "4" },
    seed: { type: "string", default: "42" },
    "audio-guide": { type: "string", default: "2" },
  },
});
if (!args.image || !args.audio || !args.out) throw new Error("--image, --audio ve --out gerekli");

const ROOT = resolve(import.meta.dirname, "../../..");
const MIME: Record<string, string> = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".mp3": "audio/mpeg", ".wav": "audio/wav" };
const dataUrl = async (p: string) =>
  `data:${MIME[extname(p).toLowerCase()] ?? "application/octet-stream"};base64,${(await readFile(resolve(ROOT, p))).toString("base64")}`;

const client = new RunpodClient(requireEnv("RUNPOD_API_KEY"), requireEnv("RUNPOD_TALK_ENDPOINT_ID"));
const input: TalkWorkerInput = {
  image_url: await dataUrl(args.image),
  audio_url: await dataUrl(args.audio),
  prompt: args.prompt!,
  resolution: args.resolution as "480" | "720",
  num_steps: Number(args.steps),
  seed: Number(args.seed),
  audio_guide_scale: Number(args["audio-guide"]),
};
const t0 = Date.now();
const job = await client.run(input);
console.log(`gönderildi: ${job.id}`);
let last = "";
for (;;) {
  await new Promise((r) => setTimeout(r, 5000));
  const s = await client.status(job.id);
  if (s.status !== last) console.log(`${((Date.now() - t0) / 1000).toFixed(0)} sn: ${(last = s.status)}`);
  if (s.status === "COMPLETED") {
    const out = s.output as Record<string, any>;
    const video = out.video_url
      ? Buffer.from(await (await fetch(out.video_url)).arrayBuffer())
      : Buffer.from(out.video_base64, "base64");
    await writeFile(resolve(ROOT, args.out), video);
    const { video_base64: _, ...info } = out;
    console.log(`tamam: ${((Date.now() - t0) / 1000).toFixed(0)} sn → ${args.out}`);
    console.log(JSON.stringify(info, null, 2));
    break;
  }
  if (["FAILED", "CANCELLED", "TIMED_OUT"].includes(s.status)) throw new Error(`${s.status}: ${s.error ?? s.output?.error ?? ""}`);
}
