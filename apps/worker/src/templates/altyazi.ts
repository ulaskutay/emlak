/**
 * Kelime kelime altyazı (Reels tarzı): konuşma video modelinden geldiği için kelime zamanları ElevenLabs Scribe ile
 * klibin sesinden çıkarılır. Yazım hep senaryodan (sayılar, özel adlar doğru yazılsın), zaman Scribe'dan.
 * En fazla 3 kelimelik gruplar, konuşulan kelime vurgulu; ffmpeg `ass` filtresiyle yakılır.
 */
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { ElevenLabsClient, type Word } from "@arsa/providers";
import { ffmpeg } from "./common.js";

/** ffmpeg `ass=...:fontsdir=` için yazı tipleri (Bricolage Grotesque). */
export const SUBTITLE_FONTS = fileURLToPath(new URL("../../fonts", import.meta.url));

const norm = (w: string) => w.toLocaleLowerCase("tr").replace(/[^\p{L}\p{N}]/gu, "");
/**
 * Duyulan kelime senaryodakiyle aynı mı: Scribe kesmeyi ve kısa ekleri farklı yazabiliyor ("Acıbadem'de" / "Acıbademde",
 * "daire" / "daireyi"), ama uydurma uzantı eşleşmez ("daire" / "dairegilde").
 */
const same = (a: string, b: string) => {
  const x = norm(a);
  const y = norm(b);
  return x === y || (Math.min(x.length, y.length) >= 3 && Math.abs(x.length - y.length) <= 2 && (x.startsWith(y) || y.startsWith(x)));
};

/**
 * Senaryonun kelimelerini duyulan kelimelerin zamanlarına hizalar (en uzun ortak dizi). Yazım hep senaryodan:
 * model bir kelimeyi tekrarlayınca ("yür yüz") ya da Scribe yanlış duyunca altyazı bozulmasın. Eşleşmeyen senaryo
 * kelimeleri komşu eşleşmelerin arasına eşit aralıkla yerleşir.
 */
function align(script: string[], heard: Word[]): Word[] {
  const n = script.length;
  const m = heard.length;
  const L = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--) L[i]![j] = same(script[i]!, heard[j]!.word) ? L[i + 1]![j + 1]! + 1 : Math.max(L[i + 1]![j]!, L[i]![j + 1]!);
  const hit = new Array<Word | null>(n).fill(null);
  for (let i = 0, j = 0; i < n && j < m; ) {
    if (same(script[i]!, heard[j]!.word)) (hit[i] = heard[j]!), i++, j++;
    else if (L[i + 1]![j]! >= L[i]![j + 1]!) i++;
    else j++;
  }
  const first = heard[0]!.start;
  const last = heard[m - 1]!.end;
  return script.map((word, i) => {
    if (hit[i]) return { word, start: hit[i]!.start, end: hit[i]!.end };
    // Önceki ve sonraki eşleşmenin arası, eşleşmeyen kelime sayısına bölünür.
    let a = i - 1;
    while (a >= 0 && !hit[a]) a--;
    let b = i + 1;
    while (b < n && !hit[b]) b++;
    const from = a >= 0 ? hit[a]!.end : first;
    const to = b < n ? hit[b]!.start : last;
    const step = Math.max(0, to - from) / (b - a - 1);
    const start = from + step * (i - a - 1);
    return { word, start, end: start + step };
  });
}

/**
 * Klibin kelimeleri, klip başına göre zamanlarıyla. ElevenLabs anahtarı yoksa boş (video altyazısız çıkar).
 * Ses 16 kHz mono gönderilir (Scribe için yeterli, yükleme küçük).
 */
export async function clipWords(file: string, text: string, workFile: string): Promise<Word[]> {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) return [];
  await ffmpeg(["-i", file, "-vn", "-ac", "1", "-ar", "16000", "-b:a", "64k", workFile]);
  const { words: said } = await new ElevenLabsClient({ apiKey: key }).transcribeWords(await readFile(workFile));
  const script = text.split(/\s+/).filter((w) => norm(w));
  return said.length ? align(script, said) : [];
}

/** ASS zamanı: 0:00:01.23 */
const ts = (t: number) => {
  const cs = Math.max(0, Math.round(t * 100));
  const h = Math.floor(cs / 360000);
  const m = Math.floor((cs % 360000) / 6000);
  const s = Math.floor((cs % 6000) / 100);
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs % 100).padStart(2, "0")}`;
};
const escAss = (t: string) => t.replace(/\\/g, "\\\\").replace(/[{}]/g, "");

/** En fazla 3 kelime, noktalamada bölünür (drone reel'deki chunkWords ile aynı kural). */
function chunks(words: Word[]) {
  const out: Word[][] = [];
  let cur: Word[] = [];
  for (const w of words) {
    cur.push(w);
    if (cur.length >= 3 || /[.,!?;:]$/.test(w.word)) (out.push(cur), (cur = []));
  }
  if (cur.length) out.push(cur);
  return out;
}

/**
 * ASS altyazı dosyası: grup ekranda kalır, o an konuşulan kelime sarı (sitenin vurgu rengi #FFC24D) ve biraz büyük.
 * Konum alt üçte bir; en alttaki "Sanal sunucu" notunun üstünde.
 */
export async function writeSubtitles(words: Word[], file: string, W: number, H: number) {
  const size = Math.round(W * 0.08);
  const header = [
    "[Script Info]",
    "ScriptType: v4.00+",
    `PlayResX: ${W}`,
    `PlayResY: ${H}`,
    "WrapStyle: 2",
    "",
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    `Style: Kelime,Bricolage Grotesque,${size},&H00FFFFFF,&H00FFFFFF,&H00000000,&H64000000,-1,0,0,0,100,100,0,0,1,6,2,2,60,60,${Math.round(H * 0.17)},1`,
    "",
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
  ];
  const events: string[] = [];
  const groups = chunks(words);
  groups.forEach((g, gi) => {
    const groupEnd = Math.min(g[g.length - 1]!.end + 0.3, groups[gi + 1]?.[0]?.start ?? Infinity);
    g.forEach((w, k) => {
      const end = k < g.length - 1 ? g[k + 1]!.start : groupEnd;
      if (end <= w.start) return;
      const text = g.map((x, j) => (j === k ? `{\\c&H004DC2FF&\\fscx108\\fscy108}${escAss(x.word)}{\\r}` : escAss(x.word))).join(" ");
      events.push(`Dialogue: 0,${ts(w.start)},${ts(end)},Kelime,,0,0,0,,${text}`);
    });
  });
  await writeFile(file, [...header, ...events, ""].join("\n"));
  return file;
}
