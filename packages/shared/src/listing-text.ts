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
  rooms: z.string().trim().regex(/^\d{1,2}\s*\+\s*\d{1,2}$/, "Oda sayısı 2+1 biçiminde olmalı").optional(),
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

const yes = (v?: string) => !!v && /^evet/i.test(v);
const strip = (s: string) => s.replace(/\s+(Mah\.?|Mh\.?|Mahallesi)$/i, "").trim();

export function parseListingText(text: string): { details: ListingDetails; priceTry?: number } {
  const t = text.replace(/\r/g, "").replace(/ /g, " ");
  const rooms = field(t, "Oda Sayısı")?.match(/(\d{1,2})\s*\+\s*(\d{1,2})/);
  const net = field(t, "m²\\s*\\(Net\\)") ?? field(t, "Net m²");
  const kind = field(t, "Emlak Tipi")?.match(/(Satılık|Kiralık)\s+(\S+(?:\s+Ev)?)/i);
  // Konum satırı: "Ankara / Etimesgut / Bağlıca Mh."
  const loc = t.match(/([A-ZÇĞİÖŞÜ][\wçğıöşü]+)\s*\/\s*([A-ZÇĞİÖŞÜ][\wçğıöşü]+)\s*\/\s*([^\n/]+)/);
  const price = t.match(/(\d{1,3}(?:\.\d{3}){1,3})\s*(?:TL|₺)/);

  const highlights: string[] = [];
  const age = field(t, "Bina Yaşı");
  if (age && /^0\b/.test(age)) highlights.push("Sıfır, hiç oturulmamış.");
  if (yes(field(t, "Site İçerisinde"))) highlights.push("Site içinde, güvenli bir yaşam.");
  const heat = field(t, "Isıtma") ?? "";
  if (/yerden/i.test(heat)) highlights.push("Yerden ısıtmalı.");
  else if (/kombi/i.test(heat)) highlights.push("Doğalgaz kombili.");
  if (yes(field(t, "Asansör"))) highlights.push("Asansörlü bina.");
  if (/kapalı/i.test(field(t, "Otopark") ?? "")) highlights.push("Kapalı otoparklı.");
  if (yes(field(t, "Krediye Uygun"))) highlights.push("Krediye uygun.");

  return {
    details: {
      kind: kind ? `${kind[1]} ${kind[2]}` : undefined,
      rooms: rooms ? `${rooms[1]}+${rooms[2]}` : undefined,
      netM2: net && /^\d+/.test(net) ? Number(net.match(/^\d+/)![0]) : undefined,
      location: loc ? `${loc[2]} ${strip(loc[3]!)}` : undefined,
      highlights: highlights.slice(0, 5),
    },
    priceTry: price ? Number(price[1]!.replace(/\./g, "")) : undefined,
  };
}

/** "2+1" → "iki artı bir" */
const spokenRooms = (r: string) => r.split("+").map((x) => numberWords(Number(x))).join(" artı ");

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

/**
 * Sahne sahne anlatım. İlk oda: ilanın kimliği (yer, tip, oda sayısı, m²). Sonraki odalar: öne çıkan
 * özellikler sırayla, bitince odanın kendi cümlesi. Kalan özellikler ve fiyat kapanışta.
 */
export function stagingNarration(rooms: (keyof typeof ROOM_LINES)[], d: Partial<ListingDetails> = {}, priceTry?: number) {
  // "Satılık Villa" → "satılık, dört artı bir, iki yüz yirmi metrekare villa"
  const [deal, ...noun] = (d.kind ?? "").toLocaleLowerCase("tr").split(/\s+/).filter(Boolean);
  const isDeal = deal === "satılık" || deal === "kiralık";
  const attrs = [isDeal && deal, d.rooms && spokenRooms(d.rooms), d.netM2 && `${numberWords(d.netM2)} metrekare`].filter(Boolean).join(", ");
  const name = (isDeal ? noun.join(" ") : [deal, ...noun].join(" ")) || "daire";
  const where = d.location ? `${locative(d.location)} ` : "";
  const opener = d.location || d.rooms || d.netM2 ? `${where}${attrs} ${name}. Eşyalı halini görün!` : "Bu evi bir de eşyalı hayal edin.";
  const highlights = [...(d.highlights ?? [])];
  // Kısa özellik cümlesi odanın cümlesiyle birlikte söylenir (sahne ~6 sn; uzarsa kurgu sahneyi uzatır).
  const lines = rooms.map((r, i) => {
    if (i === 0) return opener;
    const h = highlights.shift();
    return h ? (h.length <= 32 ? `${h} ${ROOM_LINES[r]}` : h) : ROOM_LINES[r];
  });
  const outro = [...highlights.slice(0, 2), priceTry ? `Fiyatı ${spokenPrice(priceTry)} lira.` : "", "Detaylar için hemen arayın!"].filter(Boolean).join(" ");
  return { rooms: lines, outro };
}
