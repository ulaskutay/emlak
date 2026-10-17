/**
 * Hızlı kurgu önizlemesi (seslendirmesiz, düşük fps): sahne akışını birkaç dakika yerine ~1 dakikada görmek için.
 *   pnpm --filter @arsa/drone-studio exec tsx --env-file-if-exists=../../.env scripts/preview.ts <çıktı klasörü> [fps]
 * Ezine örnek parseli ve test ilan bilgileriyle; çevre bağlamı (mahalle sınırı dahil) context.json'a önbelleklenir.
 */
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { prepareParcel, type ParcelContext } from "@arsa/geo";
import type { ParcelInfo } from "../src/types.js";
import { renderDrone } from "./render.js";
import { buildStory } from "./story.js";
import { buildTimeline } from "./timeline.js";

const [out, fps] = process.argv.slice(2);
const ROOT = resolve(import.meta.dirname, "../../..");
const ctxFile = join(ROOT, "assets/parcels/ezine-230-ada-3/context.json");
const cached = existsSync(ctxFile) ? (JSON.parse(await readFile(ctxFile, "utf8")) as ParcelContext) : null;
const parcel = (await prepareParcel(await readFile(join(ROOT, "assets/parcels/ezine-230-ada-3.geojson"), "utf8"), { cached })) as unknown as ParcelInfo;
if (cached && cached.hood === undefined && parcel.hood) await writeFile(ctxFile, JSON.stringify({ ...cached, hood: parcel.hood }, null, 2));
const story = buildStory(parcel, { priceTry: 12500000, zoning: "Tarla, imarsız", officeName: "Test Emlak", phone: "0532 000 00 00" });
for (const s of story.scenes) console.log(s.id.padEnd(9), s.text);
console.log("kutucuk:", story.features?.map((f) => `${f.icon} ${f.label}: ${f.value}`).join(" | "));
const tl = buildTimeline(parcel, story);
console.log("süre", tl.duration.toFixed(1), "mahalle", parcel.hood?.name, parcel.hood?.ring.length);
const r = await renderDrone({ parcel, story, googleKey: process.env.GOOGLE_MAPS_API_KEY!, outDir: out!, fps: Number(fps ?? 3), parallel: 4, log: (m) => console.log(m) });
console.log(`önizleme: ${r.video} · ${r.frames} kare · ${r.seconds.total.toFixed(0)} sn`);
process.exit(0);
