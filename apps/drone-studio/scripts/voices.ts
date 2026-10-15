/**
 * Türkçe sesleri listeler; --samples ile her sesle parselin kanca cümlesini seslendirip karşılaştırma örnekleri üretir.
 *
 *   pnpm voices [-- --samples --parcel assets/parcels/<dosya>.geojson]
 *
 * Örnekler: assets/parcels/<ad>/reel/samples/<ses>.mp3 (panelde ses seçimi bu listeyle yapılacak)
 */
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, extname, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { prepareParcel, type ParcelContext } from "@arsa/geo";
import { ElevenLabsClient } from "@arsa/providers";
import type { ParcelInfo } from "../src/main.js";
import { buildStory } from "./story.js";

const { values: args } = parseArgs({
  args: process.argv.slice(2).filter((a) => a !== "--"),
  options: { samples: { type: "boolean", default: false }, parcel: { type: "string" }, text: { type: "string" } },
});
const key = process.env.ELEVENLABS_API_KEY;
if (!key) throw new Error("ELEVENLABS_API_KEY .env içinde yok");
const el = new ElevenLabsClient({ apiKey: key, model: process.env.ELEVENLABS_MODEL });

const voices = await el.turkishVoices();
for (const v of voices) console.log(`${v.native ? "★" : " "} ${v.id}  ${v.name.padEnd(14)} ${(v.gender ?? "").padEnd(7)} ${v.description ?? ""}`.slice(0, 160));
console.log(`\n${voices.length} Türkçe ses (★ ana dili Türkçe)`);

if (args.samples) {
  const ROOT = resolve(import.meta.dirname, "../../..");
  let text = args.text;
  let dir = join(ROOT, "assets/voice-samples");
  if (!text && args.parcel) {
    const outDir = join(ROOT, "assets/parcels", basename(args.parcel, extname(args.parcel)));
    const ctxFile = join(outDir, "context.json");
    const cached = existsSync(ctxFile) ? (JSON.parse(await readFile(ctxFile, "utf8")) as ParcelContext) : null;
    const parcel = await prepareParcel(await readFile(resolve(ROOT, args.parcel), "utf8"), { cached });
    text = buildStory(parcel as unknown as ParcelInfo).scenes[0]!.text;
    dir = join(outDir, "reel/samples");
  }
  text ??= "Ezine Dalyan'da 11 dönüm zeytinlik! Denize sadece 4,2 kilometre.";
  await mkdir(dir, { recursive: true });
  console.log(`\nÖrnek cümle: "${text}"`);
  for (const v of voices.filter((x) => x.native)) {
    const file = join(dir, `${v.name.toLocaleLowerCase("tr").replace(/[^a-z0-9çğıöşü]+/g, "-")}.mp3`);
    const sp = await new ElevenLabsClient({ apiKey: key, voiceId: v.id, model: process.env.ELEVENLABS_MODEL }).speak(text);
    await writeFile(file, sp.audio);
    console.log(`  ${v.name.padEnd(14)} ${sp.duration.toFixed(1)} sn → ${file}`);
  }
}
