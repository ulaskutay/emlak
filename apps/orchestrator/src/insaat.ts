/**
 * İnşaat videosu (yerel CLI): arsanın yandan yakın çekiminden bitmiş yapıya ~20 sn timelapse,
 * imar bilgisini okuyan seslendirme, veri kartları ve emlakçı kapanış kartı.
 * Hat worker'daki şablonla ortak: apps/worker/src/templates/insaat-hat.ts (adımların açıklaması orada).
 *
 *   pnpm insaat -- --parcel assets/parcels/<ad> [--start side-net.png] [--type konut] [--floors 4] [--clips 4]
 *     --candidates 4      bitmiş yapı karesi için farklı seed'lerle aday üretip durur (insaat-…-aday-s<seed>.png)
 *     --pick <seed>       seçilen adayla videoyu üretir
 *     --emsal 1.20 [--taks 0.30] [--imar Konut] [--price 12500000]
 *                         inşaat efektleri + imar bilgisini okuyan seslendirme + veri kartları + fon müziği (…-sesli.mp4)
 *     --approach yaklasma.mp4
 *                         başa drone yaklaşma çekimi (panelde tarayıcıda çizilen; drone stüdyosu önizlemesinde de alınır)
 *     --name "Ad Soyad" --office "Ofis" --phone "0532 …" [--photo foto.jpg] [--logo logo.png]
 *                         sonuna emlakçı kapanış kartı (4 sn; fiyat kartta yazar, seslendirmede okunur)
 *
 * --start: netleştirilmiş yan kare (drone-studio `still` + `edit-image` ile). Ara çıktılar parsel klasörüne
 * insaat-* adıyla yazılır; var olan adımlar tekrar üretilmez.
 */
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { HiggsfieldCli } from "@arsa/providers";
import { BuildingType } from "@arsa/shared";
import { appendOutro, buildConstruction, editImage, endPrompt, prependApproach, SEGMENT_SECONDS, type Gen } from "../../worker/src/templates/insaat-hat.js";
import { addConstructionAudio, readParcelInfo } from "../../worker/src/templates/insaat-ses.js";

const { values: args } = parseArgs({
  args: process.argv.slice(2).filter((a) => a !== "--"),
  options: {
    parcel: { type: "string" },
    start: { type: "string", default: "side-net.png" },
    type: { type: "string", default: "konut" },
    floors: { type: "string", default: "4" },
    clips: { type: "string", default: "4" }, // 4 × ~5 sn = 20 sn
    seed: { type: "string", default: "7" },
    candidates: { type: "string" },
    approach: { type: "string" },
    pick: { type: "string" },
    // Ses: imar bilgisi (imar durumu belgesinden). --emsal verilmezse video sessiz kalır.
    imar: { type: "string", default: "Konut" },
    emsal: { type: "string" },
    taks: { type: "string" },
    price: { type: "string" },
    music: { type: "boolean", default: true },
    // Kapanış kartı; biri verilirse eklenir.
    name: { type: "string" },
    office: { type: "string" },
    phone: { type: "string" },
    photo: { type: "string" },
    logo: { type: "string" },
    rent: { type: "boolean", default: false },
  },
});
if (!args.parcel) throw new Error("--parcel assets/parcels/<ad> gerekli");
const ROOT = resolve(import.meta.dirname, "../../..");
// Dosya yolları işe başlamadan denetlenir: yanlış yol GPU işlerinden sonra, kapanışta patlamasın.
for (const k of ["photo", "logo"] as const) {
  const full = args[k] && resolve(ROOT, args[k]!);
  if (full && !existsSync(full)) throw new Error(`--${k}: ${full} yok. Dosyayı bu yola koyun ya da --${k} seçeneğini kaldırın.`);
}

const dir = resolve(ROOT, args.parcel);
const type = BuildingType.parse(args.type);
const floors = Number(args.floors);
const seed = Number(args.pick ?? args.seed);
const start = join(dir, args.start!);
const base = (x: string) => join(dir, `insaat-${type}-${floors}k-${x}`);
const name = (x: string) => base(`s${seed}-${x}`);
const gen: Gen = { hf: new HiggsfieldCli(), log: console.log };
const t0 = Date.now();

// Bitmiş yapı adayları: model kat sayısını her seed'de tutturamayabilir, doğru olan elle seçilir.
if (args.candidates) {
  const seeds = Array.from({ length: Number(args.candidates) }, (_, i) => seed + i);
  await Promise.all(seeds.map((s) => editImage(gen, start, endPrompt(type, floors), base(`aday-s${s}.png`), `aday s${s}`, s)));
  console.log(`Adaylar hazır: ${seeds.map((s) => base(`aday-s${s}.png`)).join(", ")}\nSeçip --pick <seed> ile çalıştırın.`);
  process.exit(0);
}

const cand = base(`aday-s${seed}.png`);
const final = await buildConstruction({
  gen,
  start,
  type,
  floors,
  clips: Number(args.clips),
  seed,
  name,
  end: existsSync(name("bitis.png")) ? name("bitis.png") : existsSync(cand) ? cand : undefined,
});
console.log(`Video hazır: ${final} (toplam ${((Date.now() - t0) / 1000).toFixed(0)} sn)`);

// Kapanış kartı
// Drone yaklaşma çekimi: başa eklenir, inşaat ve ses o kadar kayar.
let construction = final;
let offset = 0;
if (args.approach) ({ video: construction, offset } = await prependApproach(gen, resolve(ROOT, args.approach), final, final.replace(/\.mp4$/, "-yaklasmali.mp4")));

let video = construction;
let outroAt: number | undefined;
if (args.name || args.office || args.phone) {
  const work = name("kapanis");
  await mkdir(work, { recursive: true });
  ({ video, outroAt } = await appendOutro(construction, construction.replace(/\.mp4$/, "-kapanis.mp4"), work, {
    price: args.price ? `${Number(args.price).toLocaleString("tr-TR")} TL` : undefined,
    rent: args.rent!,
    name: args.name,
    office: args.office,
    phone: args.phone,
    photo: args.photo ? resolve(ROOT, args.photo) : null,
    logo: args.logo ? resolve(ROOT, args.logo) : null,
  }));
}

// Ses: aşamalara göre inşaat efektleri, imar bilgisini okuyan seslendirme, veri kartları, fon müziği.
if (args.emsal) {
  const info = await readParcelInfo(dir);
  const sesli = video.replace(/\.mp4$/, "-sesli.mp4");
  const cues = await addConstructionAudio({
    video,
    out: sesli,
    cacheDir: dir,
    segment: SEGMENT_SECONDS,
    music: args.music,
    script: {
      place: info.place,
      areaM2: info.areaM2,
      priceTry: args.price ? Number(args.price) : undefined,
      outroAt,
      offset,
      zoning: { use: args.imar!, emsal: Number(args.emsal), taks: args.taks ? Number(args.taks) : undefined, floors },
    },
  });
  for (const c of cues) console.log(`  ${c.at.toFixed(1)}–${(c.at + c.dur).toFixed(1)} sn: ${c.text}`);
  console.log(`Sesli video: ${sesli}`);
}
