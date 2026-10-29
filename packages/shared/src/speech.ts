/** Seslendirme metni için Türkçe yardımcılar: sayıların okunuşu ve bulunma eki. */

/** Fiyatın okunuşu: 12.500.000 → "on iki buçuk milyon", 3.750.000 → "üç milyon yedi yüz elli bin". */
export function spokenPrice(tl: number) {
  if (tl >= 1_000_000 && tl % 500_000 === 0) return `${halves(tl / 1_000_000)} milyon`;
  return numberWords(tl);
}

/** Türkçe bulunma eki: Dalyan'da, Ezine'de, Kocaeli'nde değil — özel adlar için kesme işaretiyle. */
export function locative(word: string) {
  const vowels = word.toLocaleLowerCase("tr").match(/[aeıioöuü]/g);
  const last = vowels?.[vowels.length - 1] ?? "e";
  const back = "aıou".includes(last);
  const hard = /[çfhkpsşt]$/i.test(word);
  return `${word}'${hard ? "t" : "d"}${back ? "a" : "e"}`;
}

/**
 * TKGM yer adlarında "ı" zaman zaman "i" yazılıyor ("Sırapınar" → "Sirapinar", "Balıklı" → "Balikli"; "İ" → "I"),
 * seslendirme de adı öyle okuyor. Bozulma tek yönlü: adın her kelimesi, diğer kaynaklarda (Google adresi, yer adları)
 * harf harf aynı olan bir yazım varsa ı/İ'leri ondan alır. Kaynaklarda doğru yazım yoksa ad olduğu gibi kalır.
 */
export function fixDotlessI(name: string, sources: (string | null | undefined)[]) {
  const fold = (w: string) => w.toLocaleLowerCase("tr").replace(/ı/g, "i");
  const words = sources.flatMap((s) => s?.match(/\p{L}+/gu) ?? []);
  return name.replace(/\p{L}+/gu, (w) => {
    const same = words.filter((c) => c.length === w.length && fold(c) === fold(w));
    return [...w]
      .map((o, i) => {
        if (o === "i" && same.some((c) => c[i]!.toLocaleLowerCase("tr") === "ı")) return "ı";
        if (o === "I" && same.some((c) => c[i] === "İ")) return "İ";
        return o;
      })
      .join("");
  });
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
export function halves(x: number) {
  const r = Math.round(x * 2) / 2;
  const whole = Math.floor(r);
  if (r - whole === 0) return numberWords(whole);
  return whole === 0 ? "yarım" : `${numberWords(whole)} buçuk`;
}

/** Sıra sayısının okunuşu: 1 → "birinci", 4 → "dördüncü", 20 → "yirminci". */
export function ordinalWords(n: number) {
  const w = numberWords(n).replace(/dört$/, "dörd");
  const vowels = w.match(/[aeıioöuü]/g);
  const last = vowels?.[vowels.length - 1] ?? "i";
  const v = "aı".includes(last) ? "ı" : "ei".includes(last) ? "i" : "ou".includes(last) ? "u" : "ü";
  return /[aeıioöuü]$/.test(w) ? `${w}nc${v}` : `${w}${v}nc${v}`;
}

/**
 * Video modelinin kendisi seslendirdiği metinde rakam bırakılmaz (model rakamları bozuk ya da İngilizce okuyabiliyor):
 * "20. kat" → "yirminci kat", "2+1" → "iki artı bir", "89 m²" → "seksen dokuz metrekare", diğer tam sayılar yazıyla.
 * İlan kısaltmaları da açılır ("Mah." → "Mahallesi", "%20" → "yüzde yirmi", "5 dk" → "beş dakika"): ses modeli
 * kısaltmayı harf harf ya da İngilizce okuyabiliyor.
 */
export function speakable(text: string) {
  return text
    // Numaralı sokak/cadde yalın okunur ("1250. Sokak"), adlı olan iyelikli ("Cumhuriyet Caddesi").
    .replace(/(\d+\.\s*)(?:Sok|Sk)\.?(?=\s|$)/g, "$1Sokak")
    .replace(/(\d+\.\s*)(?:Cad|Cd)\.?(?=\s|$)/g, "$1Cadde")
    .replace(/\b(?:Mah|Mh)\.?(?=\s|$)/g, "Mahallesi")
    .replace(/\b(?:Cad|Cd)\.?(?=\s|$)/g, "Caddesi")
    .replace(/\b(?:Sok|Sk)\.?(?=\s|$)/g, "Sokağı")
    .replace(/\b(?:Bulv|Blv|Bul)\.?(?=\s|$)/g, "Bulvarı")
    .replace(/\bvb\./g, "ve benzeri")
    .replace(/%\s*(\d+)/g, (_, n: string) => `yüzde ${numberWords(Number(n))}`)
    .replace(/(\d)\s*(?:dk|dak)\.?(?=$|[\s,!?])/g, "$1 dakika")
    .replace(/(\d)\s*km\b/g, "$1 kilometre")
    .replace(/\bNo:?\s*(?=\d)/g, "numara ")
    .replace(/(\d)\s*mt?\.?(?=\s+(?:mesafe|yürü|uzak))/g, "$1 metre")
    .replace(/(\d+)(?:[.,](5))?\s*\+\s*(\d+)/g, (_, a: string, half: string | undefined, b: string) =>
      `${numberWords(Number(a))}${half ? " buçuk" : ""} artı ${numberWords(Number(b))}`)
    .replace(/(\d+)\.(?=\s*\p{L})/gu, (_, n: string) => ordinalWords(Number(n)))
    .replace(/\s*m²|\s*m2\b/gi, " metrekare")
    .replace(/\s*(?:TL|₺)(?=$|[\s.,!?])/g, " lira")
    .replace(/\d{1,3}(?:\.\d{3})+|\d+/g, (n) => numberWords(Number(n.replace(/\./g, ""))));
}
