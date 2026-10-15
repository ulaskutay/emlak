/**
 * Senaryo: parsel ve çevre bilgisinden sahne sahne Türkçe anlatım (Reels dili: kanca → yerler → özet → çağrı).
 *
 * Sahne kimlikleri zaman çizelgesiyle eşleşir: hook (açılış), poi-<index> (tur bacağı), summary, final.
 * Seslendirme (voice) eklenince kurgu ona göre uzar ve altyazı kelime kelime vurgulanır.
 */
import type { ParcelInfo } from "../src/main.js";

export interface StoryWord {
  word: string;
  start: number;
  end: number;
}

export interface StoryScene {
  id: string;
  text: string;
  /** Seslendirme: süre ve kelime zamanları (klip başına göre saniye). */
  voice?: { duration: number; words: StoryWord[]; file?: string };
}

export interface Story {
  scenes: StoryScene[];
}

/** Türkçe bulunma eki: Dalyan'da, Ezine'de, Kocaeli'nde değil — özel adlar için kesme işaretiyle. */
export function locative(word: string) {
  const vowels = word.toLocaleLowerCase("tr").match(/[aeıioöuü]/g);
  const last = vowels?.[vowels.length - 1] ?? "e";
  const back = "aıou".includes(last);
  const hard = /[çfhkpsşt]$/i.test(word);
  return `${word}'${hard ? "t" : "d"}${back ? "a" : "e"}`;
}

const ONES = ["", "bir", "iki", "üç", "dört", "beş", "altı", "yedi", "sekiz", "dokuz"];
const TENS = ["", "on", "yirmi", "otuz", "kırk", "elli", "altmış", "yetmiş", "seksen", "doksan"];

/**
 * Sayının Türkçe okunuşu (230 → "iki yüz otuz"). Seslendirmeye rakam gönderilmez: ElevenLabs ondalıkları
 * ("4,2") ve büyük sayıları Türkçe okurken bozabiliyor; kartlarda kesin değer yine rakamla görünür.
 */
export function numberWords(n: number): string {
  n = Math.round(n);
  if (n === 0) return "sıfır";
  const under1000 = (x: number) => {
    const h = Math.floor(x / 100);
    const rest = x % 100;
    return [h === 0 ? "" : h === 1 ? "yüz" : `${ONES[h]} yüz`, TENS[Math.floor(rest / 10)], ONES[rest % 10]].filter(Boolean).join(" ");
  };
  const parts: string[] = [];
  const millions = Math.floor(n / 1_000_000);
  const thousands = Math.floor((n % 1_000_000) / 1000);
  const rest = n % 1000;
  if (millions) parts.push(`${under1000(millions)} milyon`);
  if (thousands) parts.push(thousands === 1 ? "bin" : `${under1000(thousands)} bin`);
  if (rest) parts.push(under1000(rest));
  return parts.join(" ");
}

/** Yarımlara yuvarlanmış okunuş: 1,5 → "bir buçuk", 0,5 → "yarım". */
function halves(x: number) {
  const r = Math.round(x * 2) / 2;
  const whole = Math.floor(r);
  if (r - whole === 0) return numberWords(whole);
  return whole === 0 ? "yarım" : `${numberWords(whole)} buçuk`;
}

/** Arsa dilinde alan: 2.000 m² üstü dönümle ("on bir dönüm"), altı metrekareyle. */
export function spokenArea(m2: number) {
  if (m2 < 2000) return `${numberWords(Math.round(m2 / 10) * 10)} metrekare`;
  return `${halves(m2 / 1000)} dönüm`;
}

/** Konuşma dilinde mesafe: "sekiz yüz elli metre", "bir buçuk kilometre", "on altı kilometre". */
export function spokenDistance(m: number) {
  if (m < 950) return `${numberWords(Math.round(m / 50) * 50)} metre`;
  const km = m / 1000;
  return `${km >= 10 ? numberWords(km) : halves(km)} kilometre`;
}

function poiLine(poi: ParcelInfo["pois"][number]) {
  const d = spokenDistance(poi.distanceM);
  const name = poi.name?.trim();
  switch (poi.label) {
    case "Deniz / Plaj":
      return name ? `Denize, ${name} kıyısına sadece ${d}.` : `Denize sadece ${d}.`;
    case "İlçe Merkezi":
      return `${name ?? "İlçe"} merkezine ${d}.`;
    case "Köy Merkezi":
      return `${name ?? "Köy"} köy merkezi ${d} ötede.`;
    case "Metro / Raylı Sistem":
      return `${name ?? "Raylı sistem"} istasyonuna ${d}.`;
    case "Ana Yol":
      return `Ana yola ${d}, ulaşım çok kolay.`;
    case "Hastane":
      return `${name ?? "Hastane"} ${d} mesafede.`;
    case "Okul":
    case "Üniversite":
      return `${name ?? poi.label} ${d} mesafede.`;
    case "AVM":
      return `${name ?? "Alışveriş merkezi"} ${d} uzaklıkta.`;
    default:
      return `${name ?? poi.label}: ${d}.`;
  }
}

/** Tur sahnesine girecek yerler: zaman çizelgesiyle aynı seçim (≤ 20 km, ilk 3). */
export function tourPois(p: ParcelInfo) {
  return p.pois.map((poi, index) => ({ poi, index })).filter(({ poi }) => poi.distanceM <= 20000).slice(0, 3);
}

export function buildStory(p: ParcelInfo): Story {
  const prop = p.properties;
  const district = prop.Ilce ?? p.address.district;
  const hood = (prop.Mahalle ?? p.address.neighbourhood)?.replace(/ (Mahallesi|Mah\.?|Köyü)$/i, "");
  const place = [district, hood].filter(Boolean).join(" ");
  const kind = (prop.Nitelik ?? "arsa").toLocaleLowerCase("tr");
  const area = spokenArea(p.areaM2);
  const tour = tourPois(p);
  const beach = tour.find(({ poi }) => poi.label === "Deniz / Plaj");

  // Kanca: ilk 3 saniyede yer + büyüklük (+ varsa deniz), izleyiciyi tutan bilgi.
  const hook = `${place ? `${locative(place)} ` : ""}${area} ${kind}!${beach ? ` Denize sadece ${spokenDistance(beach.poi.distanceM)}.` : ""}`;

  const scenes: StoryScene[] = [{ id: "hook", text: hook }];
  for (const { poi, index } of tour) {
    // Kancada deniz söylendiyse sahil sahnesi tekrar etmesin, yerin adını öne çıkarsın.
    const line = poi === beach?.poi && poi.name ? `${poi.name} ve masmavi deniz.` : poiLine(poi);
    scenes.push({ id: `poi-${index}`, text: line });
  }
  if (tour.length) scenes.push({ id: "summary", text: "Doğanın içinde, her yere yakın." });
  const num = (v: string) => (/^\d+$/.test(v) ? numberWords(Number(v)) : v);
  const parcelNo = prop.Ada && prop.ParselNo ? `${num(prop.Ada)} ada, ${num(prop.ParselNo)} parsel. ` : "";
  scenes.push({ id: "final", text: `${parcelNo}Detaylar için hemen mesaj atın!` });
  // Cümle başı büyük harf (sayı okunuşuyla başlayan sahneler: "İki yüz otuz ada…").
  for (const sc of scenes) sc.text = sc.text.charAt(0).toLocaleUpperCase("tr") + sc.text.slice(1);
  return { scenes };
}
