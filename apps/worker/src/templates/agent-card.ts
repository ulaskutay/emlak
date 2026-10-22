/**
 * Kapanış kartı (dikey, sitenin görünümüyle): son odanın bulanıklaştırılmış hali üstünde fiyat, emlakçı kartı
 * (altın halkalı fotoğraf, ad, ofis, telefon), "Hemen arayın" düğmesi ve ofis logosu; parçalar sırayla kayarak belirir.
 *
 * Şekiller ve görseller SVG'den (sharp), yazılar ffmpeg drawtext ile sitenin yazı tipleriyle basılır
 * (librsvg gömülü yazı tipi okumuyor). Her katman tam ekran saydam PNG; son kurguda zamanlı bindirilir.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { esc, ffmpeg } from "./common.js";

const W = 1080;
const H = 1920;
const FPS = 30;
const GOLD = "#ffc24d";
const INK = "#121a16";
const font = (f: string) => fileURLToPath(new URL(`../../fonts/${f}.ttf`, import.meta.url));
const DISPLAY = font("BricolageGrotesque-ExtraBold");
const DISPLAY_BOLD = font("BricolageGrotesque-Bold");
const SANS = font("InstrumentSans-Regular");
const SANS_SEMI = font("InstrumentSans-SemiBold");

export interface AgentCardInput {
  price?: string;
  rent: boolean;
  name?: string;
  office?: string;
  phone?: string;
  photo?: string | null;
  logo?: string | null;
  /** Arka plan: son odanın döşenmiş karesi. */
  background: string;
  seconds: number;
}

/** Harf aralıklı etiket ("A Y L I K  K İ R A"): drawtext harf aralığı desteklemez, ince boşluk eklenir. */
const spaced = (t: string) => [...t.toLocaleUpperCase("tr")].join(" ");
const fit = (t: string, n: number) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);

function text(t: string, fontfile: string, size: number, y: number, color = "white") {
  return `drawtext=fontfile='${fontfile}':expansion=none:text='${esc(t)}':fontsize=${size}:fontcolor=${color}:x=(w-text_w)/2:y=${y}`;
}

/** SVG (şekil + görsel) → PNG, üstüne yazılar. */
async function layer(svg: string, texts: string[], out: string) {
  const base = out.replace(/\.png$/, "-base.png");
  await sharp(Buffer.from(svg)).png().toFile(base);
  if (!texts.length) return base;
  await ffmpeg(["-i", base, "-vf", `format=rgba,${texts.join(",")}`, "-frames:v", "1", out]);
  return out;
}

const dataUri = async (file: string, mime: string) => `data:${mime};base64,${(await readFile(file)).toString("base64")}`;
const svgOpen = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`;

export async function agentCard(workDir: string, a: AgentCardInput): Promise<string> {
  // Yerleşim: önce parçaların yükseklikleri, sonra bütün grup dikeyde ortalanır (Reels arayüzü üst/alt kenarı kaplar).
  const D = 300; // fotoğraf çapı
  const cx = W / 2;
  const hasPhoto = !!a.photo;
  const PRICE_H = a.price ? 200 : 0;
  const inner = hasPhoto ? D + 80 : 50;
  const cardH = inner + (a.name ? 90 : 0) + (a.office ? 64 : 0) + (a.phone ? 230 : 20) + 30;
  const CTA_H = 132;
  let logoBox: { w: number; h: number; lw: number; lh: number } | null = null;
  if (a.logo) {
    const meta = await sharp(a.logo).metadata();
    const s = Math.min(420 / (meta.width ?? 1), 130 / (meta.height ?? 1));
    const lw = Math.round((meta.width ?? 1) * s);
    const lh = Math.round((meta.height ?? 1) * s);
    logoBox = { w: lw + 64, h: lh + 48, lw, lh };
  }
  const total = PRICE_H + (PRICE_H ? 90 : 0) + cardH + 70 + CTA_H + (logoBox ? 70 + logoBox.h : 0);
  const top = Math.max(200, Math.round((H - total) / 2));

  // 1) Fiyat
  const priceTexts: string[] = [];
  if (a.price) {
    priceTexts.push(text(spaced(a.rent ? "Aylık kira" : "Satış fiyatı"), SANS_SEMI, 36, top, GOLD));
    priceTexts.push(text(a.price, DISPLAY, 140, top + 50));
  }
  const priceLayer = await layer(`${svgOpen}</svg>`, priceTexts, join(workDir, "kart-fiyat.png"));

  // 2) Emlakçı kartı
  const cardTop = top + PRICE_H + (PRICE_H ? 90 : 0);
  const photoY = cardTop + 56;
  let svg = `${svgOpen}<defs><clipPath id="c"><circle cx="${cx}" cy="${photoY + D / 2}" r="${D / 2}"/></clipPath>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1c2822" stop-opacity="0.93"/><stop offset="1" stop-color="${INK}" stop-opacity="0.93"/></linearGradient></defs>
    <rect x="80" y="${cardTop}" width="${W - 160}" height="${cardH}" rx="48" fill="url(#g)" stroke="${GOLD}" stroke-opacity="0.35" stroke-width="2"/>`;
  if (hasPhoto) {
    svg += `<circle cx="${cx}" cy="${photoY + D / 2}" r="${D / 2 + 11}" fill="none" stroke="${GOLD}" stroke-width="6"/>
      <image x="${cx - D / 2}" y="${photoY}" width="${D}" height="${D}" preserveAspectRatio="xMidYMid slice" clip-path="url(#c)" href="${await dataUri(a.photo!, "image/jpeg")}"/>`;
  }
  let y = cardTop + inner;
  const cardTexts: string[] = [];
  if (a.name) {
    cardTexts.push(text(fit(a.name, 24), DISPLAY_BOLD, 74, y));
    y += 90;
  }
  if (a.office) {
    cardTexts.push(text(fit(a.office, 34), SANS, 40, y, "0xc9cfc6"));
    y += 64;
  }
  if (a.phone) {
    y += 30;
    svg += `<rect x="${cx - 70}" y="${y}" width="140" height="4" rx="2" fill="${GOLD}"/>`;
    cardTexts.push(text(spaced("Cep telefonu"), SANS_SEMI, 30, y + 38, GOLD));
    cardTexts.push(text(a.phone, DISPLAY, 96, y + 84));
  }
  const cardLayer = await layer(`${svg}</svg>`, cardTexts, join(workDir, "kart-emlakci.png"));

  // 3) Düğme ve logo
  const ctaY = cardTop + cardH + 70;
  let svg3 = `${svgOpen}<rect x="${cx - 320}" y="${ctaY}" width="640" height="${CTA_H}" rx="${CTA_H / 2}" fill="${GOLD}"/>`;
  if (logoBox) {
    const boxY = ctaY + CTA_H + 70;
    svg3 += `<rect x="${cx - logoBox.w / 2}" y="${boxY}" width="${logoBox.w}" height="${logoBox.h}" rx="28" fill="white"/>
      <image x="${cx - logoBox.lw / 2}" y="${boxY + 24}" width="${logoBox.lw}" height="${logoBox.lh}" href="${await dataUri(a.logo!, "image/png")}"/>`;
  }
  // Düğme yazısı yazı tipinin gerçek yüksekliğine göre ortalanır (drawtext y'si üst kenardır).
  const ctaText = `drawtext=fontfile='${DISPLAY_BOLD}':expansion=none:text='${esc("Hemen arayın")}':fontsize=58:fontcolor=${INK.replace("#", "0x")}:x=(w-text_w)/2:y=${ctaY + CTA_H / 2}-ascent/2-descent/2`;
  const ctaLayer = await layer(`${svg3}</svg>`, [ctaText], join(workDir, "kart-dugme.png"));

  // 4) Kurgu: bulanık arka plan yavaşça yakınlaşır, katmanlar sırayla 40 px aşağıdan kayarak belirir.
  const T = a.seconds;
  const frames = Math.round(T * FPS);
  const enter = (st: number) => `'40*max(0,1-(t-${st})/0.45)'`;
  const out = join(workDir, "kapanis.mp4");
  await ffmpeg([
    "-loop", "1", "-framerate", String(FPS), "-i", a.background,
    "-loop", "1", "-framerate", String(FPS), "-i", priceLayer,
    "-loop", "1", "-framerate", String(FPS), "-i", cardLayer,
    "-loop", "1", "-framerate", String(FPS), "-i", ctaLayer,
    "-filter_complex",
    [
      `[0:v]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},gblur=sigma=26,eq=brightness=-0.16:saturation=0.75,` +
        `zoompan=z='1+0.05*on/${frames}':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=1:s=${W}x${H}:fps=${FPS},` +
        `drawbox=x=0:y=0:w=iw:h=ih:color=black@0.38:t=fill,format=rgba[bg]`,
      `[1:v]format=rgba,fade=t=in:st=0.05:d=0.45:alpha=1[l1]`,
      `[2:v]format=rgba,fade=t=in:st=0.3:d=0.45:alpha=1[l2]`,
      `[3:v]format=rgba,fade=t=in:st=0.6:d=0.45:alpha=1[l3]`,
      `[bg][l1]overlay=0:${enter(0.05)}:eval=frame[a]`,
      `[a][l2]overlay=0:${enter(0.3)}:eval=frame[b]`,
      `[b][l3]overlay=0:${enter(0.6)}:eval=frame,format=yuv420p[out]`,
    ].join(";"),
    "-map", "[out]", "-t", String(T), "-r", String(FPS), "-c:v", "libx264", "-crf", "18", "-pix_fmt", "yuv420p", out,
  ]);
  return out;
}
