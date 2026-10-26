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
  for (const b of descriptionBullets(t)) if (picked.length < 5 && !picked.includes(b)) picked.push(b);

  return {
    details: {
      kind: kind ? `${kind[1]} ${kind[2]}` : undefined,
      rooms: rooms ? `${rooms[1]!.replace(",", ".")}+${rooms[2]}` : undefined,
      netM2: net && /^\d+/.test(net) ? Number(net.match(/^\d+/)![0]) : undefined,
      location: loc ? `${loc[2]} ${strip(loc[3]!)}` : undefined,
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

/** Sunucunun bir sahnede (en fazla 10 sn'lik klip) söyleyebileceği kelime: ~2,2 kelime/sn, baş ve sonda pay. */
export const PRESENTER_WORDS = 18;

/** Sunucunun odaya girerken söylediği kısa giriş. */
const PRESENTER_ROOM_LINES: Record<keyof typeof ROOM_LINES, string> = {
  salon: "Şimdi salondayız, geniş ve gün boyu aydınlık.",
  yatak_odasi: "Yatak odası ferah ve sakin.",
  cocuk_odasi: "Çocuk odası aydınlık ve kullanışlı.",
  mutfak: "Mutfak geniş ve kullanışlı.",
  yemek_odasi: "Yemek odası kalabalık sofralara uygun.",
  calisma_odasi: "Çalışma odası sessiz ve verimli.",
  banyo: "Banyo ferah ve bakımlı.",
  balkon: "Balkon sabah kahvesi için birebir.",
};

/**
 * Sunuculu ev turu: oda başına sunucunun kameraya söylediği cümle(ler). Her sahne PRESENTER_WORDS kelimeyi aşmaz.
 * İlk oda: selam + ilanın kimliği. Aradakiler: oda + öne çıkan özellikler. Son oda: fiyat ve çağrı.
 * Video modeli metni kendisi seslendirdiği için sayılar yazıyla verilir.
 */
export function presenterNarration(rooms: (keyof typeof ROOM_LINES)[], d: Partial<ListingDetails> = {}, priceTry?: number) {
  const [deal, ...noun] = (d.kind ?? "").toLocaleLowerCase("tr").split(/\s+/).filter(Boolean);
  const isDeal = deal === "satılık" || deal === "kiralık";
  const attrs = [isDeal && deal, d.rooms && spokenRooms(d.rooms), d.netM2 && `${numberWords(d.netM2)} metrekare`].filter(Boolean).join(", ");
  const name = (isDeal ? noun.join(" ") : [deal, ...noun].join(" ")) || "daire";
  const where = d.location ? `${locative(d.location)} ` : "";
  const hello = d.location || d.rooms || d.netM2 ? `Merhaba! Bugün ${where}${attrs} bir ${name} geziyoruz.` : "Merhaba! Bu evi birlikte geziyoruz.";
  const price = priceTry ? `${deal === "kiralık" ? "Aylık kirası" : "Fiyatı"} ${spokenPrice(priceTry)} lira.` : "";
  const outro = price ? `${price} Hemen arayın!` : "Detaylar için hemen arayın!";

  const highlights = [...(d.highlights ?? [])];
  return rooms.map((r, i) => {
    const last = i === rooms.length - 1;
    const said: string[] = [];
    let left = PRESENTER_WORDS - (i === 0 ? words(hello) : 0) - (last ? words(outro) : 0);
    // Önce ilanın öne çıkanları (son odada sığdığı kadar, diğerlerinde birer tane), sonra sığarsa odanın cümlesi.
    while (highlights.length && words(highlights[0]!) <= left) {
      left -= words(highlights[0]!);
      said.push(highlights.shift()!);
      if (!last) break;
    }
    const room = PRESENTER_ROOM_LINES[r];
    // Ara odada hiçbir şey söylenmeyecekse oda cümlesi sınırı aşsa da söylenir (sessiz sahne olmasın).
    const withRoom = words(room) <= left || (i > 0 && !said.length);
    return [i === 0 ? hello : "", withRoom ? room : "", ...said, last ? outro : ""].filter(Boolean).join(" ");
  });
}
