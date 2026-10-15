/**
 * Arsa Reels akışı: parsel → senaryo → seslendirme → sese göre kurgu → drone render → ses miksi → son video.
 *
 *   pnpm reel -- --parcel assets/parcels/<dosya>.geojson [--voice <id>] [--runpod] [--no-voice] [--no-music] [--parallel 8]
 *
 *   1. Parsel + çevre (önbellekli context.json)
 *   2. Senaryo: sahne sahne Türkçe anlatım (scripts/story.ts)
 *   3. ElevenLabs seslendirme, kelime zamanlarıyla (önbellekli: metin değişmedikçe tekrar ödenmez)
 *   4. Kurgu sese göre: uçuşlar anlatım kadar sürer, altyazı kelime kelime (scripts/timeline.ts)
 *   5. Drone render: yerel ya da RunPod worker'ı (--runpod)
 *   6. Ses miksi: anlatım + fon müziği (konuşurken kısılır) + geçiş efektleri; hafif renk düzeltme
 *
 * Çıktı: assets/parcels/<ad>/reel/reel.mp4 (ara dosyalar aynı klasörde)
 */
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, extname, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { prepareParcel, type ParcelContext } from "@arsa/geo";
import { ElevenLabsClient, RunpodClient } from "@arsa/providers";
import type { ParcelInfo } from "../src/main.js";
import { buildStory, type Story } from "./story.js";
import { buildTimeline } from "./timeline.js";

const { values: args } = parseArgs({
  args: process.argv.slice(2).filter((a) => a !== "--"),
  options: {
    parcel: { type: "string" },
    runpod: { type: "boolean", default: false },
    "no-voice": { type: "boolean", default: false },
    "no-music": { type: "boolean", default: false },
    "skip-render": { type: "boolean", default: false }, // yalnızca ses/miks (mevcut drone.mp4 ile)
    parallel: { type: "string", default: "8" },
    voice: { type: "string" }, // ElevenLabs ses kimliği (pnpm voices ile listelenir)
  },
});
if (!args.parcel) throw new Error("--parcel assets/parcels/<dosya>.geojson gerekli");

const ROOT = resolve(import.meta.dirname, "../../..");
const parcelFile = resolve(ROOT, args.parcel);
const outDir = join(ROOT, "assets/parcels", basename(args.parcel, extname(args.parcel)));
const reelDir = join(outDir, "reel");
await mkdir(reelDir, { recursive: true });
const t0 = Date.now();
const step = (m: string) => console.log(`\n[${((Date.now() - t0) / 1000).toFixed(0).padStart(4)} sn] ${m}`);
const hash = (s: string) => createHash("sha1").update(s).digest("hex").slice(0, 10);

function run(cmd: string, argv: string[], cwd = ROOT): Promise<void> {
  return new Promise((res, rej) => {
    const p = spawn(cmd, argv, { cwd, stdio: "inherit" });
    p.on("close", (c) => (c === 0 ? res() : rej(new Error(`${cmd} ${c}`))));
  });
}

// 1) Parsel + çevre
step("Parsel ve çevre bilgisi");
const contextFile = join(outDir, "context.json");
const cached = existsSync(contextFile) ? (JSON.parse(await readFile(contextFile, "utf8")) as ParcelContext) : null;
const parcelText = await readFile(parcelFile, "utf8");
const parcel = (await prepareParcel(parcelText, { cached })) as unknown as ParcelInfo & ParcelContext;
if (parcel.pois.length && !cached) {
  const { elevation, elevationSource, address, pois } = parcel;
  await writeFile(contextFile, JSON.stringify({ elevation, elevationSource, address, pois }, null, 2));
}

// 2) Senaryo
step("Senaryo");
const story: Story = buildStory(parcel);
for (const s of story.scenes) console.log(`  ${s.id.padEnd(8)} ${s.text}`);

// 3) Seslendirme + müzik + efekt (ElevenLabs)
const elKey = process.env.ELEVENLABS_API_KEY;
const el = elKey ? new ElevenLabsClient({ apiKey: elKey, voiceId: args.voice ?? process.env.ELEVENLABS_VOICE_ID, model: process.env.ELEVENLABS_MODEL }) : null;
if (!el && !args["no-voice"]) console.log("  ! ELEVENLABS_API_KEY yok: seslendirmesiz devam");
if (el && !args["no-voice"]) {
  step("Seslendirme (ElevenLabs)");
  const voiceId = await el.resolveVoice();
  for (const [i, s] of story.scenes.entries()) {
    const key = hash(`${voiceId}|${process.env.ELEVENLABS_MODEL}|${s.text}`);
    const mp3 = join(reelDir, `voice-${s.id}-${key}.mp3`);
    const meta = mp3.replace(/\.mp3$/, ".json");
    if (!existsSync(meta)) {
      const sp = await el.speak(s.text, { previous: story.scenes[i - 1]?.text, next: story.scenes[i + 1]?.text });
      await writeFile(mp3, sp.audio);
      await writeFile(meta, JSON.stringify({ duration: sp.duration, words: sp.words }));
    }
    const v = JSON.parse(await readFile(meta, "utf8")) as { duration: number; words: { word: string; start: number; end: number }[] };
    s.voice = { ...v, file: mp3 };
    console.log(`  ${s.id.padEnd(8)} ${v.duration.toFixed(1)} sn`);
  }
}

const timeline = buildTimeline(parcel, story);
console.log(`  Kurgu: ${timeline.duration.toFixed(1)} sn · ${timeline.cues.length} anlatım · ${timeline.whooshes.length} geçiş`);
const storyFile = join(reelDir, "story.json");
// Worker'a dosya yolları gitmez; yalnızca metin, süre ve kelime zamanları.
await writeFile(storyFile, JSON.stringify({ scenes: story.scenes.map((s) => ({ ...s, voice: s.voice && { duration: s.voice.duration, words: s.voice.words } })) }));

let music: string | null = null;
let whoosh: string | null = null;
if (el && !args["no-music"]) {
  step("Fon müziği ve geçiş efekti");
  const len = Math.ceil(timeline.duration) + 2;
  music = join(reelDir, `music-${len}.mp3`);
  if (!existsSync(music)) {
    await el
      .music(
        "Cinematic, uplifting modern real estate drone video background. Warm ambient pads, soft piano, light percussion, " +
          "gentle build, hopeful and premium mood, no vocals, steady 100 bpm, clean ending.",
        len,
      )
      .then((b) => writeFile(music!, b))
      .catch((e) => {
        console.log(`  ! müzik üretilemedi (${String(e).slice(0, 160)}) — müziksiz devam`);
        music = null;
      });
  }
  whoosh = join(reelDir, "whoosh.mp3");
  if (!existsSync(whoosh)) {
    await el
      .soundEffect("Smooth cinematic air whoosh transition, drone flying fast past the camera, clean, no music", 1.2)
      .then((b) => writeFile(whoosh!, b))
      .catch((e) => {
        console.log(`  ! efekt üretilemedi (${String(e).slice(0, 160)})`);
        whoosh = null;
      });
  }
}

// 5) Drone render
const droneVideo = join(reelDir, "drone.mp4");
if (!args["skip-render"]) {
  if (args.runpod) {
    step("Drone render (RunPod)");
    const client = new RunpodClient(process.env.RUNPOD_API_KEY!, process.env.RUNPOD_DRONE_ENDPOINT_ID!);
    const job = await client.run({
      parcel: parcelText,
      context: { elevation: parcel.elevation, elevationSource: parcel.elevationSource, address: parcel.address, pois: parcel.pois },
      story: JSON.parse(await readFile(storyFile, "utf8")),
      output_prefix: `reels/${basename(outDir)}/${Date.now()}`,
    });
    console.log(`  iş ${job.id}`);
    let last = "";
    for (;;) {
      await new Promise((r) => setTimeout(r, 4000));
      const s = await client.status(job.id);
      const progress = s.output as unknown;
      if (s.status === "IN_PROGRESS" && typeof progress === "string") {
        const line = progress.trim().split("\n").pop() ?? "";
        if (line !== last) console.log(`  │ ${(last = line)}`);
      }
      if (s.status === "COMPLETED") {
        const v = (s.output as any).video as { url?: string; base64?: string };
        const buf = v.base64 ? Buffer.from(v.base64, "base64") : Buffer.from(await (await fetch(v.url!)).arrayBuffer());
        await writeFile(droneVideo, buf);
        console.log(`  WebGL: ${(s.output as any).renderer} · çalışma ${((s.executionTime ?? 0) / 1000).toFixed(0)} sn`);
        break;
      }
      if (["FAILED", "CANCELLED", "TIMED_OUT"].includes(s.status)) throw new Error(`RunPod: ${s.status} ${s.error ?? ""}`.slice(0, 1500));
    }
  } else {
    step("Drone render (yerel)");
    await run("pnpm", ["exec", "tsx", "scripts/record.ts", "--parcel", args.parcel, "--story", storyFile, "--parallel", args.parallel!], join(ROOT, "apps/drone-studio"));
    await run("cp", [join(outDir, "drone.mp4"), droneVideo]);
  }
}

// 6) Ses miksi + renk düzeltme
step("Ses miksi ve son video");
const D = timeline.duration;
const inputs: string[] = ["-i", droneVideo];
const filters: string[] = [];
const buses: string[] = [];
let n = 1;
const voiceCues = timeline.cues.filter((c) => c.file);
if (voiceCues.length) {
  const labels = voiceCues.map((c, i) => {
    inputs.push("-i", c.file!);
    const ms = Math.round(c.at * 1000);
    filters.push(`[${n++}:a]adelay=${ms}|${ms},aresample=44100[v${i}]`);
    return `[v${i}]`;
  });
  filters.push(`${labels.join("")}amix=inputs=${labels.length}:normalize=0,volume=1.15,asplit=2[voice][vsc]`);
  buses.push("[voice]");
}
if (music) {
  inputs.push("-i", music);
  const m = n++;
  filters.push(`[${m}:a]atrim=0:${D.toFixed(2)},afade=t=in:d=0.6,afade=t=out:st=${(D - 2.5).toFixed(2)}:d=2.5,volume=0.5[mus]`);
  // Anlatım varken müzik kısılır (ducking).
  if (voiceCues.length) filters.push(`[mus][vsc]sidechaincompress=threshold=0.02:ratio=10:attack=15:release=450:makeup=1[mduck]`), buses.push("[mduck]");
  else buses.push("[mus]");
} else if (voiceCues.length) filters.push(`[vsc]anullsink`);
if (whoosh && timeline.whooshes.length) {
  inputs.push("-i", whoosh);
  const w = n++;
  const k = timeline.whooshes.length;
  filters.push(`[${w}:a]asplit=${k}${timeline.whooshes.map((_, i) => `[w${i}]`).join("")}`);
  timeline.whooshes.forEach((t, i) => {
    const ms = Math.max(0, Math.round((t - 0.35) * 1000));
    filters.push(`[w${i}]adelay=${ms}|${ms},volume=0.45[wd${i}]`);
  });
  filters.push(`${timeline.whooshes.map((_, i) => `[wd${i}]`).join("")}amix=inputs=${k}:normalize=0[wh]`);
  buses.push("[wh]");
}
const out = join(reelDir, "reel.mp4");
const ff = ["-v", "error", "-y", ...inputs];
if (buses.length) {
  filters.push(`${buses.join("")}amix=inputs=${buses.length}:normalize=0,alimiter=limit=0.95,apad[aout]`);
  ff.push("-filter_complex", filters.join(";"), "-map", "0:v", "-map", "[aout]", "-c:a", "aac", "-b:a", "192k");
} else ff.push("-map", "0:v");
// Hafif renk düzeltme: uydu görüntüsü biraz soluk, kontrast ve doygunluk artırılır.
ff.push("-vf", "eq=contrast=1.05:saturation=1.12,unsharp=5:5:0.35:5:5:0", "-c:v", "libx264", "-crf", "19", "-preset", "medium",
  "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-t", D.toFixed(2), out);
await run("ffmpeg", ff);
step(`Hazır: ${out}`);
