/**
 * Konut ilanı bilgisi: kullanıcının yapıştırdığı ilan sayfası metninden (sahibinden.com vb.) ayıklanır,
 * formda düzeltilir ve "boş evi döşe" anlatımına dönüşür. Siteler sunucudan okunmaya izin vermediği için
 * (bot koruması, 403) metni kullanıcı kopyalar.
 */
import { z } from "zod";
import { locative, numberWords, spokenPrice } from "./speech.js";

export const ListingDetails = z.object({
  /** "Satılık Daire", "Kiralık Villa"… */
  kind: z.string().trim().max(40).optional(),
  /** "2+1" */
  rooms: z.string().trim().regex(/^\d{1,2}(?:[.,]5)?\s*\+\s*\d{1,2}$/, "Oda sayısı 2+1 biçiminde olmalı").optional(),
  netM2: z.coerce.number().int().min(10).max(5000).optional(),
  /** "Etimesgut Bağlıca" */
  location: z.string().trim().max(60).optional(),
  /** İl ("Ankara"): yakın yerler için konumu aramada kullanılır. */
  province: z.string().trim().max(30).optional(),
  /** İlan başlığı (sayfadan, olduğu gibi). */
  title: z.string().trim().max(120).optional(),
  /** Anlatımda geçecek kısa cümleler ("Site içinde.", "Krediye uygun."). */
  highlights: z.array(z.string().trim().min(2).max(80)).max(5).default([]),
});
export type ListingDetails = z.infer<typeof ListingDetails>;

/** Etiketin ardından gelen değer: "Oda Sayısı 2+1" ya da "Oda Sayısı\n2+1" (kopyalanan tabloda sekme/satır). */
function field(text: string, label: string) {
  const m = text.match(new RegExp(`(?:^|\\n)\\s*${label}\\s*[:\\t]?\\s*\\n?\\s*([^\\n\\t]+)`, "i"));
  return m?.[1]?.trim();
}

const yes = (v?: string) => !!v && /^(evet|var)\b/i.test(v);
const strip = (s: string) => s.replace(/\s+(Mah\.?|Mh\.?|Mahallesi)$/i, "").trim();

/** Büyük harfli ilan satırını cümleye çevirir: "EBEVEYN BANYOLU - 20.KAT" → "Ebeveyn banyolu, 20. kat." */
function sentence(line: string) {
  let t = line.replace(/[\u200b-\u200d\ufeff]/g, "").trim().replace(/\s+-\s+/g, ", ").replace(/\s{2,}/g, " ");
  if (t === t.toLocaleUpperCase("tr")) t = t.toLocaleLowerCase("tr");
  t = t.replace(/(\d)\.(\p{L})/gu, "$1. $2");
  t = t.charAt(0).toLocaleUpperCase("tr") + t.slice(1);
  return /[.!?]$/.test(t) ? t : `${t}.`;
}

/** Açıklamadaki madde işaretli Türkçe satırlar (emlakçının öne çıkardıkları); İngilizce tekrarları atlanır. */
function descriptionBullets(text: string) {
  const at = text.search(/\nAçıklama\s*\n/);
  if (at < 0) return [];
  return text
    .slice(at)
    .split("\n")
    .map((l) => l.match(/^\s*[-•*–]\s*(.{4,70})$/)?.[1])
    .filter((l): l is string => !!l && !/\b(the|and|with|rooms?|bedrooms?|ready|square|meters?|bathrooms?)\b/i.test(l))
    // Oda sayısı ve metrekare zaten ilk cümlede (tablodan, net alanla) söylenir.
    .filter((l) => !/metrekare|m²|m2\b|\d\s*\+\s*\d|\boda\b.*\bsalon\b/i.test(l))
    .map(sentence);
}

/** Açıklamada ilanı öne çıkaran kısa düz cümleler (madde işaretsiz yazılmış ilanlar için): anahtar kelimeli olanlar. */
const SELLING = /manzara|metro|marmaray|metrobüs|havuz|otopark|site|güvenlik|sıfır|yeni|aydınlık|ferah|cephe|bahçe|asansör|krediye|deniz|park|okul|avm|merkez|lüks|geniş|teras|ebeveyn|giyinme|ankastre|doğalgaz|yerden ısıtma/i;
function descriptionSentences(text: string) {
  const at = text.search(/\nAçıklama\s*\n/);
  if (at < 0) return [];
  return text
    .slice(at + 10, at + 3000)
    .split(/(?<=[.!?])\s+|\n+/)
    .map((l) => l.replace(/^\s*[-•*–]\s*/, "").trim())
    .filter((l) => l.split(/\s+/).length >= 3 && l.split(/\s+/).length <= 12 && SELLING.test(l))
    .filter((l) => !/\b(the|and|with|rooms?|bedrooms?)\b/i.test(l) && !/metrekare|m²|m2\b|\d\s*\+\s*\d|tel|whatsapp|arayın|ofis|emlak/i.test(l))
    .map(sentence);
}

export function parseListingText(text: string): { details: ListingDetails; priceTry?: number } {
  const t = text.replace(/\r/g, "").replace(/ /g, " ");
  const rooms = field(t, "Oda Sayısı")?.match(/(\d{1,2}(?:[.,]5)?)\s*\+\s*(\d{1,2})/);
  const net = field(t, "m²\\s*\\(Net\\)") ?? field(t, "Net m²");
  const kind = field(t, "Emlak Tipi")?.match(/(Satılık|Kiralık)\s+(\S+(?:\s+Ev)?)/i);
  // Konum satırı: tam üç parça, "İl / İlçe / Mahalle" ("Ankara / Etimesgut / Bağlıca Mh."). Sayfanın gezinme satırı
  // ("Emlak / Konut / Kiralık / Daire") dört parçalıdır; mahalle içeren satır önceliklidir.
  const three = t
    .split("\n")
    .map((l) => l.match(/^\s*([^/\t]+?)\s*\/\s*([^/\t]+?)\s*\/\s*([^/\t]+?)\s*$/))
    .filter((m): m is RegExpMatchArray => !!m && !/^emlak$/i.test(m[1]!.trim()));
  const loc = three.find((m) => /\b(Mh\.?|Mah\.?|Mahallesi|Köyü?)$/i.test(m[3]!)) ?? three[0];
  const price = t.match(/(\d{1,3}(?:\.\d{3}){1,3})\s*(?:TL|₺)/);

  const highlights: string[] = [];
  const age = field(t, "Bina Yaşı");
  if (age && /^0\b/.test(age)) highlights.push("Sıfır, hiç oturulmamış.");
  const site = field(t, "Site Adı");
  if (yes(field(t, "Site İçerisinde"))) highlights.push(site && site.length <= 40 ? `${site} içinde.` : "Site içinde, güvenli bir yaşam.");
  const heat = field(t, "Isıtma") ?? "";
  if (/yerden/i.test(heat)) highlights.push("Yerden ısıtmalı.");
  else if (/kombi/i.test(heat)) highlights.push("Doğalgaz kombili.");
  if (yes(field(t, "Asansör"))) highlights.push("Asansörlü bina.");
  if (/kapalı/i.test(field(t, "Otopark") ?? "")) highlights.push("Kapalı otoparklı.");
  if (yes(field(t, "Krediye Uygun"))) highlights.push("Krediye uygun.");

  // Tablodan en fazla 2 özellik, kalanı emlakçının açıklamadaki maddeleri.
  const picked = [...highlights.slice(0, 2)];
  for (const b of [...descriptionBullets(t), ...descriptionSentences(t)]) if (picked.length < 5 && !picked.includes(b)) picked.push(b);

  return {
    details: {
      kind: kind ? `${kind[1]} ${kind[2]}` : undefined,
      rooms: rooms ? `${rooms[1]!.replace(",", ".")}+${rooms[2]}` : undefined,
      netM2: net && /^\d+/.test(net) ? Number(net.match(/^\d+/)![0]) : undefined,
      location: loc ? `${loc[2]} ${strip(loc[3]!)}` : undefined,
      province: loc?.[1]?.trim(),
      highlights: picked,
    },
    priceTry: price ? Number(price[1]!.replace(/\./g, "")) : undefined,
  };
}

/** "2+1" → "iki artı bir", "2.5+1" → "iki buçuk artı bir" */
const spokenRooms = (r: string) =>
  r
    .split("+")
    .map((x) => (Number(x) % 1 ? `${numberWords(Math.floor(Number(x)))} buçuk` : numberWords(Number(x))))
    .join(" artı ");

/** Oda başına bir cümle; ilan bilgisi yoksa sahnede bu söylenir. */
export const ROOM_LINES = {
  salon: "Geniş salonda ailenizle keyifli akşamlar sizi bekliyor.",
  yatak_odasi: "Gün ışığıyla uyanacağınız ferah bir yatak odası.",
  cocuk_odasi: "Çocuğunuz için rengârenk, aydınlık bir oda.",
  mutfak: "Sofranızı kuracağınız aydınlık, kullanışlı bir mutfak.",
  yemek_odasi: "Kalabalık sofralara yakışan şık bir yemek odası.",
  calisma_odasi: "Evden çalışmak için sessiz, verimli bir köşe.",
  banyo: "Ferah ve bakımlı bir banyo.",
  balkon: "Sabah kahvenizi içeceğiniz huzurlu bir balkon.",
  dis_cephe: "Bakımlı ve şık bir binada.",
} as const;

/** Anlatımın kelime bütçesi: seslendirme ~2,2 kelime/sn, 21 sn'lik videoda boşluklarla birlikte ~40 kelime sığar. */
export const NARRATION_WORDS = 40;
const words = (t: string) => t.split(/\s+/).filter(Boolean).length;

/**
 * Sahne sahne anlatım (toplam NARRATION_WORDS kelimeyi aşmaz). İlk oda: ilanın kimliği (yer, tip, oda sayısı, m²).
 * Sonraki odalar: öne çıkan özellikler sırayla, sığarsa odanın kendi cümlesi; sığmayan sahne sessiz geçer.
 * Kapanış: fiyat ve çağrı.
 */
export function stagingNarration(rooms: (keyof typeof ROOM_LINES)[], d: Partial<ListingDetails> = {}, priceTry?: number) {
  // "Satılık Villa" → "satılık, dört artı bir, iki yüz yirmi metrekare villa"
  const [deal, ...noun] = (d.kind ?? "").toLocaleLowerCase("tr").split(/\s+/).filter(Boolean);
  const isDeal = deal === "satılık" || deal === "kiralık";
  const attrs = [isDeal && deal, d.rooms && spokenRooms(d.rooms), d.netM2 && `${numberWords(d.netM2)} metrekare`].filter(Boolean).join(", ");
  const name = (isDeal ? noun.join(" ") : [deal, ...noun].join(" ")) || "daire";
  const where = d.location ? `${locative(d.location)} ` : "";
  const opener = d.location || d.rooms || d.netM2 ? `${where}${attrs} ${name}. Eşyalı halini görün!` : "Bu evi bir de eşyalı hayal edin.";
  const price = priceTry ? `${deal === "kiralık" ? "Aylık kirası" : "Fiyatı"} ${spokenPrice(priceTry)} lira.` : "";
  const outro = price ? `${price} Hemen arayın!` : "Detaylar için hemen arayın!";

  let left = NARRATION_WORDS - words(opener) - words(outro);
  const highlights = [...(d.highlights ?? [])];
  const take = (t: string) => (words(t) <= left ? ((left -= words(t)), t) : "");
  const lines = rooms.map((r, i) => {
    if (i === 0) return opener;
    const h = highlights.shift();
    const line = (h && take(h)) || "";
    // Özellik kısaysa ve bütçe kalırsa odanın cümlesi de eklenir; özellik yoksa yalnız odanın cümlesi.
    const room = !h || line ? take(ROOM_LINES[r]) : "";
    return [line, room].filter(Boolean).join(" ");
  });
  return { rooms: lines, outro };
}

/**
 * Sunuculu tur: bir sahnede (Gemini Omni klibi en fazla 10 sn) söylenebilecek kelime, ~2,2 kelime/sn ve pay.
 * Kullanıcı metni düzenlerse sınır sipariş şemasında da denetlenir (TOUR_MAX_WORDS).
 */
export const TOUR_WORDS = 19;
export const TOUR_MAX_WORDS = 24;

/** Sahne türleri: odalar + binanın dışı / site alanı (RoomType ile aynı). */
export type TourSceneType = keyof typeof ROOM_LINES;

/** Sunucunun sahneye girerken söylediği canlı cümle. */
const TOUR_LINES: Record<TourSceneType, string> = {
  salon: "İşte salon! Geniş, ferah ve gün boyu ışık alıyor.",
  yatak_odasi: "Yatak odasına geçelim, huzurlu ve aydınlık!",
  cocuk_odasi: "Çocuk odası rengârenk hayallere hazır!",
  mutfak: "Mutfağa bakın, geniş ve çok kullanışlı!",
  yemek_odasi: "Yemek odası kalabalık sofralar için birebir!",
  calisma_odasi: "Çalışma odası sessiz ve verimli bir köşe!",
  banyo: "Banyo ferah, modern ve tertemiz!",
  balkon: "Balkona çıkalım, sabah kahvesi için harika!",
  dis_cephe: "Binanın dışına bakın, bakımlı ve şık bir yapı!",
};

/** Formun yakın yer önerisi: en yakın anlamlı nokta (metro, okul, AVM…). */
export interface TourNearby {
  category: string;
  name?: string;
  distanceM: number;
}

const NEAR_NOUN: Record<string, string> = {
  metro: "Metroya",
  school: "Okula",
  mall: "Alışveriş merkezine",
  hospital: "Hastaneye",
  park: "Parka",
  beach: "Denize",
  sea: "Denize",
  supermarket: "Markete",
  university: "Üniversiteye",
};

/** "Metroya yürüyerek beş dakika!" / "Alışveriş merkezine arabayla on dakika!" (yürüme ~80 m/dk, şehir içi araç ~500 m/dk). */
export function nearbyLine(n: TourNearby) {
  const noun = NEAR_NOUN[n.category];
  if (!noun) return "";
  const walk = Math.max(1, Math.round(n.distanceM / 80));
  if (walk <= 15) return `${noun} yürüyerek sadece ${numberWords(walk)} dakika!`;
  const drive = Math.max(2, Math.round(n.distanceM / 500));
  return drive <= 20 ? `${noun} arabayla ${numberWords(drive)} dakika!` : "";
}

/**
 * Sunuculu ev turunun senaryosu: sahne başına sunucunun kameraya söylediği canlı cümleler (TOUR_WORDS kelimeyi aşmaz).
 * İlk sahne: selam + ilanın kimliği. Ara sahneler: sahnenin cümlesi + öne çıkan özellik. Konum cümlesi (yakın yer)
 * binanın dışı sahnesinde, yoksa sondan bir önceki sahnede. Son sahne: fiyat ve çağrı. Sayılar yazıyla (model okur).
 * Kullanıcı her sahnenin metnini panelde değiştirebilir.
 */
export function tourScript(scenes: TourSceneType[], d: Partial<ListingDetails> = {}, nearby: TourNearby[] = [], priceTry?: number) {
  const [deal, ...noun] = (d.kind ?? "").toLocaleLowerCase("tr").split(/\s+/).filter(Boolean);
  const isDeal = deal === "satılık" || deal === "kiralık";
  const attrs = [d.rooms && spokenRooms(d.rooms), d.netM2 && `${numberWords(d.netM2)} metrekare`].filter(Boolean).join(", ");
  const name = [isDeal && deal, (isDeal ? noun.join(" ") : [deal, ...noun].join(" ")) || "daire"].filter(Boolean).join(" ");
  const where = d.location ? `${locative(d.location)} ` : "";
  const hello = d.location || attrs ? `Merhaba! ${where}${attrs ? `${attrs} ` : ""}${name} sizi bekliyor, hadi gezelim!` : "Merhaba! Bu harika evi birlikte gezelim!";
  const price = priceTry ? `${deal === "kiralık" ? "Aylık kirası" : "Fiyatı"} sadece ${spokenPrice(priceTry)} lira!` : "";
  const outro = price ? `${price} Kaçırmayın, hemen arayın!` : "Kaçırmayın, hemen arayın!";
  const near = nearby.map(nearbyLine).find(Boolean) ?? "";
  // İlk sahnede selam, son sahnede fiyat ve çağrı yer kaplıyor: dış cephe bunlardan biriyse konum sondan bir öncekine.
  const ext = scenes.indexOf("dis_cephe");
  const nearAt = !near ? -1 : ext > 0 && ext < scenes.length - 1 ? ext : Math.max(0, scenes.length - 2);

  const highlights = [...(d.highlights ?? [])];
  return scenes.map((r, i) => {
    const last = i === scenes.length - 1;
    const parts: string[] = [];
    let left = TOUR_WORDS - (i === 0 ? words(hello) : 0) - (last ? words(outro) : 0);
    const add = (t: string) => {
      if (!t || words(t) > left) return false;
      parts.push(t);
      left -= words(t);
      return true;
    };
    // İlk sahnede selam uzun: sahnenin cümlesi ancak sığarsa. Diğerlerinde önce sahnenin cümlesi, sonra konum ya da özellik.
    const line = add(TOUR_LINES[r]);
    if (i === nearAt) add(near);
    while (highlights.length && add(highlights[0]!)) if ((highlights.shift(), !last)) break;
    if (!line && !parts.length && i > 0) parts.push(TOUR_LINES[r]);
    return [i === 0 ? hello : "", ...parts, last ? outro : ""].filter(Boolean).join(" ");
  });
}
