/**
 * Senaryo: parsel ve çevre bilgisinden sahne sahne Türkçe anlatım ve ekran metinleri.
 * Kurgu arsanın etrafında döner (Reels dili):
 *
 *   hook      kanca: yer + cins ("Ezine Dalyan'da satılık zeytinlik!") — büyük başlık
 *   region    mahalle sınırı çizilir, pin düşer ("Dalyan Köyü sınırları içinde. Denize sadece dört kilometre.")
 *   scan      arsa taranır, m² sayılır ("Tam on bir dönüm.")
 *   features  farklı açılar + özellik kutucukları (ada/parsel, imar, yakın yer)
 *   final     fiyat + çağrı
 *
 * Seslendirme (voice) eklenince kurgu ona göre uzar ve altyazı kelime kelime vurgulanır.
 */
import type { ParcelInfo } from "../src/types.js";

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

/** İlan bilgileri (panel formu, packages/shared ReelListing ile aynı yapı). */
export interface StoryListing {
  priceTry?: number;
  zoning?: string;
  officeName?: string;
  phone?: string;
  /** Panelde seçilen çevre noktaları (pipeline parsel hazırlığında kullanır). */
  pois?: ParcelInfo["pois"];
}

export interface Story {
  scenes: StoryScene[];
  /** Açılış başlığı satırları ("11 DÖNÜM", "ZEYTİNLİK"). */
  hookLines?: string[];
  /** Konum etiketi: mahalle adı ve ilçe/il. */
  place?: { title: string; sub: string };
  /** Özellik kutucukları (en fazla 6). */
  features?: { icon: string; label: string; value: string }[];
  /** Kapanış kartı: ofis, telefon, fiyat (son saniyelerde görünür). */
  endcard?: { officeName?: string; phone?: string; price?: string };
  /** Başlık kartının alt satırına eklenir (ör. "Konut imarlı"). */
  zoning?: string;
}

/** Fiyatın okunuşu: 12.500.000 → "on iki buçuk milyon", 3.750.000 → "üç milyon yedi yüz elli bin". */
export function spokenPrice(tl: number) {
  if (tl >= 1_000_000 && tl % 500_000 === 0) return `${halves(tl / 1_000_000)} milyon`;
  return numberWords(tl);
}

/** Kartlarda fiyat: 12.500.000 ₺ */
export const formatPrice = (tl: number) => `${Math.round(tl).toLocaleString("tr-TR")} ₺`;

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

/**
 * Mesafe okunuşu, kartlardaki değerle (formatDistance) birebir: 850 m → "sekiz yüz elli metre",
 * 4,2 km → "dört virgül iki kilometre", 16 km → "on altı kilometre". Yuvarlanmış okunuş ekranla çelişiyordu.
 */
export function spokenDistance(m: number) {
  if (m < 1000) return `${numberWords(Math.round(m / 10) * 10)} metre`;
  const tenths = Math.round(m / 100);
  const whole = Math.floor(tenths / 10);
  const dec = tenths % 10;
  return `${numberWords(whole)}${dec ? ` virgül ${numberWords(dec)}` : ""} kilometre`;
}

function poiLine(poi: ParcelInfo["pois"][number]) {
  const d = spokenDistance(poi.distanceM);
  const name = poi.name?.trim();
  switch (poi.category) {
    case "sea":
      // Kıyı çizgisine uzaklık: dibindeyse asıl satış cümlesi budur.
      return poi.distanceM < 150 ? "Denize sıfır!" : `Denize sadece ${d}.`;
    case "beach":
      return `${name ?? "Plaj"} ${d} mesafede.`;
    case "town":
      return `${name ?? "İlçe"} merkezine ${d}.`;
    case "village":
      return `${name ?? "Köy"} köy merkezi ${d} ötede.`;
    case "airport":
      return `Havalimanına ${d}.`;
    case "metro":
      return `${name ?? "Raylı sistem"} istasyonuna ${d}.`;
    case "main_road":
      return `Ana yola ${d}, ulaşım çok kolay.`;
    case "mall":
      return `${name ?? "Alışveriş merkezi"} ${d} uzaklıkta.`;
    case "hospital":
    case "school":
    case "university":
    case "park":
    case "supermarket":
    case "custom":
    default:
      return `${name ?? poi.label} ${d} mesafede.`;
  }
}

/**
 * Uzaklaşırken gösterilecek yerler (zaman çizelgesi de bunu kullanır): ≤ 20 km, en fazla 4;
 * yakından uzağa sıralı, kamera her yerde biraz daha yükselir.
 */
export function tourPois(p: ParcelInfo) {
  return p.pois
    .map((poi, index) => ({ poi, index }))
    .filter(({ poi }) => poi.distanceM <= 20000)
    .slice(0, 4) // panelde en fazla 4 seçilir
    .sort((a, b) => a.poi.distanceM - b.poi.distanceM);
}

const fmtKm = (m: number) => (m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(m < 10000 ? 1 : 0).replace(".", ",")} km`);
const cap = (x: string) => x.charAt(0).toLocaleUpperCase("tr") + x.slice(1);

/** Seslendirmeye uygun düz metin (rakam, iki nokta yok): "Konut imarlı" evet, "E:0.30" hayır. */
const speakable = (x?: string) => (x && /^[\p{L} ,.-]+$/u.test(x) ? x.trim().replace(/[.]+$/, "") : undefined);

export function buildStory(p: ParcelInfo, listing: StoryListing = {}): Story {
  const prop = p.properties;
  const district = prop.Ilce ?? p.address.district;
  const province = prop.Il ?? p.address.province;
  const hoodRaw = p.hood?.name || prop.Mahalle || p.address.neighbourhood;
  const hoodShort = hoodRaw?.replace(/ (Mahallesi|Mah\.?|Köyü)$/i, "");
  const place = [district, hoodShort].filter(Boolean).join(" ");
  const kind = (prop.Nitelik ?? "arsa").toLocaleLowerCase("tr");
  const area = spokenArea(p.areaM2);
  const num = (v: string) => (/^\d+$/.test(v) ? numberWords(Number(v)) : v);
  const sea = p.pois.find((x) => x.category === "sea" || x.category === "beach");
  const near = p.pois.filter((x) => x !== sea).sort((a, b) => a.distanceM - b.distanceM);

  // Kanca: yer + cins; büyüklük tarama sahnesinde vurgulanır.
  const scenes: StoryScene[] = [{ id: "hook", text: `${place ? `${locative(place)} ` : ""}satılık ${kind}!` }];
  // Bölge: mahalle sınırı + (varsa) denize uzaklık — dibindeyse asıl satış cümlesi.
  const hoodLine = hoodRaw ? `${/köyü$/i.test(hoodRaw) ? hoodRaw : `${hoodShort} Mahallesi`} sınırları içinde.` : "";
  const seaLine = sea ? (sea.distanceM < 150 ? "Denize sıfır!" : `Denize sadece ${spokenDistance(sea.distanceM)}.`) : "";
  if (hoodLine || seaLine) scenes.push({ id: "region", text: [hoodLine, seaLine].filter(Boolean).join(" ") });
  scenes.push({ id: "scan", text: `Tam ${area}.` });
  // Özellikler: ada/parsel, imar, en yakın yer.
  const parcelNo = prop.Ada && prop.ParselNo ? `${num(prop.Ada)} ada, ${num(prop.ParselNo)} parsel.` : "";
  const zoning = speakable(listing.zoning);
  const nearLine = near[0] ? poiLine(near[0]) : "";
  const feat = [parcelNo, zoning ? `${cap(zoning)}.` : "", nearLine].filter(Boolean).join(" ");
  if (feat) scenes.push({ id: "features", text: feat });
  const price = listing.priceTry ? `Fiyatı ${spokenPrice(listing.priceTry)} lira. ` : "";
  scenes.push({ id: "final", text: `${price}Detaylar için hemen mesaj atın!` });
  for (const sc of scenes) sc.text = cap(sc.text);

  // Ekran metinleri
  // Başlıkta dönüm yarımlara yuvarlanır (11,09 → "11 DÖNÜM", 11,5 → "11,5 DÖNÜM"); kesin m² taramada sayılır.
  const donum = Math.round((p.areaM2 / 1000) * 2) / 2;
  const areaShort = p.areaM2 >= 2000 ? `${donum.toLocaleString("tr-TR")} DÖNÜM` : `${Math.round(p.areaM2).toLocaleString("tr-TR")} m²`;
  const hookLines = [areaShort, (prop.Nitelik ?? "ARSA").toLocaleUpperCase("tr")];
  const features: NonNullable<Story["features"]> = [];
  if (prop.Nitelik) features.push({ icon: "🌿", label: "Nitelik", value: prop.Nitelik });
  if (prop.Ada && prop.ParselNo) features.push({ icon: "📄", label: "Ada / Parsel", value: `${prop.Ada} / ${prop.ParselNo}` });
  if (listing.zoning) features.push({ icon: "🏗️", label: "İmar", value: listing.zoning });
  if (sea) features.push({ icon: "🌊", label: "Denize", value: sea.distanceM < 150 ? "Sıfır" : fmtKm(sea.distanceM) });
  for (const x of near.slice(0, 2)) features.push({ icon: x.emoji, label: x.name ?? x.label, value: fmtKm(x.distanceM) });
  if (p.elevation !== null && p.elevation !== undefined) features.push({ icon: "⛰️", label: "Rakım", value: `${Math.round(p.elevation)} m` });
  if (prop.Mevkii) features.push({ icon: "📍", label: "Mevkii", value: prop.Mevkii });

  const endcard =
    listing.officeName || listing.phone || listing.priceTry
      ? { officeName: listing.officeName, phone: listing.phone, price: listing.priceTry ? formatPrice(listing.priceTry) : undefined }
      : undefined;
  return {
    scenes,
    hookLines,
    place: { title: hoodRaw ?? place, sub: [district, province].filter(Boolean).join(", ") },
    features: features.slice(0, 6),
    endcard,
    zoning: listing.zoning,
  };
}
