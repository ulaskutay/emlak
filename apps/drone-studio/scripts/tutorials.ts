/**
 * Ana sayfa için "bu video nasıl yapılır" ekran kayıtları: her şablonun sipariş formu yerel panelde gerçekçi
 * verilerle doldurulur (görünür imleç, yumuşak hareket, gecikmeli yazma), sonuna şablonun örnek videosu eklenir.
 *
 * Sipariş OLUŞTURULMAZ: form, imleç "Videoyu oluştur" düğmesinin üzerinde durunca biter (gerçek GPU/API işi açılmasın).
 *
 *   cd apps/drone-studio && npx tsx --env-file=../../.env scripts/tutorials.ts [şablon-id ...]
 *
 * Gerekenler: apps/web geliştirme sunucusu http://localhost:3100 (TUTORIAL_BASE ile değişir), yerel test hesabı
 * (LOCAL_TEST_EMAIL / LOCAL_TEST_PASSWORD), Google Chrome ve ffmpeg.
 * Çıktı: apps/web/public/media/nasil/<id>.mp4 + .jpg ve apps/web/src/lib/tutorial-chapters.json
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Browser, Locator, Page } from "playwright-core";

const ROOT = path.resolve(import.meta.dirname, "../../..");
const BASE = process.env.TUTORIAL_BASE ?? "http://localhost:3100";
const OUT = path.join(ROOT, "apps/web/public/media/nasil");
const CHAPTERS = path.join(ROOT, "apps/web/src/lib/tutorial-chapters.json");
const MEDIA = path.join(ROOT, "apps/web/public/media");
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "arsa-tutorials-"));
const FFMPEG = process.env.FFMPEG ?? "/opt/homebrew/bin/ffmpeg";
const W = 1280;
const H = 720;
const FPS = 25;

const PARCEL = path.join(ROOT, "assets/parcels/ezine-230-ada-3.geojson");
const VILLA = (n: string) => path.join(ROOT, "assets/listings/1344614658/photos", `${n}.jpg`);
const DAIRE = (n: string) => path.join(ROOT, "assets/listings/1343619965/photos", `${n}.jpg`);
const OFFICE = "Etic Emlak";
const PHONE = "0555 000 00 00";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Kayıt sırasında imleç, bölüm işaretleri ve sıkıcı beklemelerin kesilmesi. Zamanlar sayfa açılışından saniye. */
class Rec {
  readonly t0 = Date.now();
  readonly segs: { from: number; to?: number }[] = [];
  readonly marks: { label: string; t: number }[] = [];
  poster = 0;
  x = W / 2;
  y = H / 2 + 40;
  constructor(readonly page: Page) {}

  now() {
    return (Date.now() - this.t0) / 1000;
  }
  start() {
    this.segs.push({ from: this.now() });
  }
  cut() {
    const s = this.segs.at(-1);
    if (s && s.to === undefined) s.to = this.now();
  }
  /** Bekleme videodan kesilir (yükleme, harita, API). */
  async skip(fn: () => Promise<unknown>) {
    this.cut();
    await fn();
    await sleep(250);
    this.start();
  }
  chapter(label: string) {
    this.marks.push({ label, t: this.now() });
  }
  posterHere() {
    this.poster = this.now();
  }
  /** Ham kayıttaki an → kesilmiş videodaki an. */
  final(t: number) {
    let acc = 0;
    for (const s of this.segs) {
      const to = s.to ?? Infinity;
      if (t < s.from) return acc;
      if (t <= to) return acc + (t - s.from);
      acc += to - s.from;
    }
    return acc;
  }
  formLength() {
    return this.segs.reduce((a, s) => a + ((s.to ?? this.now()) - s.from), 0);
  }

  // ---- imleç ----
  async moveXY(x: number, y: number) {
    const dx = x - this.x;
    const dy = y - this.y;
    const dist = Math.hypot(dx, dy);
    const steps = Math.max(10, Math.min(36, Math.round(dist / 16)));
    const sx = this.x;
    const sy = this.y;
    for (let i = 1; i <= steps; i++) {
      const k = 0.5 - 0.5 * Math.cos((Math.PI * i) / steps);
      await this.page.mouse.move(sx + dx * k, sy + dy * k);
      await sleep(20);
    }
    this.x = x;
    this.y = y;
  }
  /** Öğe görünür alanda değilse yumuşak kaydırma ile ortalanır. */
  async reveal(el: Locator) {
    await el.waitFor({ state: "visible", timeout: 30_000 });
    const box = await el.boundingBox();
    if (box && box.y >= 80 && box.y + box.height <= H - 30) return;
    await el.evaluate((n) => n.scrollIntoView({ behavior: "smooth", block: "center" }));
    let last = -1;
    for (let i = 0; i < 40; i++) {
      await sleep(80);
      const y = await this.page.evaluate(() => window.scrollY);
      if (y === last) break;
      last = y;
    }
    await sleep(150);
  }
  async moveTo(el: Locator, fx = 0.5, fy = 0.5) {
    await this.reveal(el);
    const box = (await el.boundingBox())!;
    await this.moveXY(box.x + box.width * fx, box.y + box.height * fy);
  }
  async click(el: Locator, fx = 0.5, fy = 0.5) {
    await this.moveTo(el, fx, fy);
    await sleep(160);
    await this.page.mouse.click(this.x, this.y);
    await sleep(340);
  }
  async type(el: Locator, text: string, delay = 55) {
    await this.click(el, 0.3);
    await this.page.keyboard.type(text, { delay });
    await sleep(450);
  }
  /** Açılır liste: yerel menü kayıtta görünmediği için tıklama halkası gösterilip değer doğrudan seçilir. */
  async select(el: Locator, value: string) {
    await this.moveTo(el, 0.6);
    await sleep(150);
    await this.page.evaluate(([x, y]) => (window as any).__ripple?.(x, y), [this.x, this.y]);
    await sleep(250);
    await el.selectOption(value);
    await sleep(380);
  }
  async upload(zone: Locator, files: string[]) {
    await this.moveTo(zone);
    await sleep(160);
    const [chooser] = await Promise.all([this.page.waitForEvent("filechooser"), this.page.mouse.click(this.x, this.y)]);
    await sleep(300);
    await chooser.setFiles(files);
  }
  /** Son adım: imleç "Videoyu oluştur" üzerinde durur, düğme hafifçe parlar. TIKLANMAZ. */
  async hoverSubmit() {
    const btn = this.page.getByRole("button", { name: "Videoyu oluştur" });
    await this.moveTo(btn);
    await btn.evaluate((b) => {
      (b as HTMLElement).style.transition = "box-shadow .3s";
      (b as HTMLElement).style.boxShadow = "0 0 0 5px rgba(255,194,77,.35), 0 0 28px rgba(255,194,77,.45)";
    });
    await sleep(1300);
  }
}

/**
 * Her sayfaya: sahte imleç + tıklama halkası; hesap adı ve Next.js geliştirici rozeti gizlenir.
 * Düz metin: tsx'in fonksiyonlara eklediği yardımcılar tarayıcıda tanımsız olurdu.
 */
const CURSOR_SCRIPT = String.raw`(() => {
  const css = [
    "#__cur{position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;will-change:transform}",
    "#__cur svg{display:block;filter:drop-shadow(0 2px 5px rgba(0,0,0,.55))}",
    ".__rip{position:fixed;width:56px;height:56px;margin:-28px 0 0 -28px;border-radius:50%;border:3px solid #ffc24d;background:rgba(255,194,77,.18);pointer-events:none;z-index:2147483646;animation:__r .6s ease-out forwards}",
    "@keyframes __r{from{transform:scale(.25);opacity:1}to{transform:scale(1.35);opacity:0}}",
    "nextjs-portal{display:none!important}",
    "header span.text-sm.text-mute{visibility:hidden!important}",
  ].join(" ");
  let cur = null;
  let pos = [640, 400];
  try { pos = JSON.parse(sessionStorage.getItem("__cur") || "[640,400]"); } catch {}
  const ensure = () => {
    if (!document.body) return null;
    if (!document.getElementById("__curstyle")) {
      const st = document.createElement("style");
      st.id = "__curstyle";
      st.textContent = css;
      document.head.appendChild(st);
    }
    if (!cur || !cur.isConnected) {
      cur = document.getElementById("__cur") || document.createElement("div");
      cur.id = "__cur";
      cur.innerHTML = '<svg width="34" height="39" viewBox="0 0 26 30"><path d="M2 2 L2 24 L8 18.5 L12.5 28 L16.5 26.2 L12 17 L20 17 Z" fill="#fff" stroke="#121a16" stroke-width="2" stroke-linejoin="round"/></svg>';
      document.body.appendChild(cur);
    }
    return cur;
  };
  const place = (x, y) => {
    pos = [x, y];
    const c = ensure();
    if (c) c.style.transform = "translate(" + (x - 2) + "px," + (y - 2) + "px)";
    try { sessionStorage.setItem("__cur", JSON.stringify(pos)); } catch {}
  };
  const ripple = (x, y) => {
    if (!document.body) return;
    const r = document.createElement("div");
    r.className = "__rip";
    r.style.left = x + "px";
    r.style.top = y + "px";
    document.body.appendChild(r);
    setTimeout(() => r.remove(), 700);
  };
  window.__ripple = ripple;
  document.addEventListener("mousemove", (e) => place(e.clientX, e.clientY), true);
  document.addEventListener("mousedown", (e) => ripple(e.clientX, e.clientY), true);
  const boot = () => place(pos[0], pos[1]);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
  // Hidrasyon gövdeyi yeniden kurarsa imleç geri eklenir.
  setInterval(() => (!cur || !cur.isConnected) && place(pos[0], pos[1]), 300);
})();`;

// ---------------------------------------------------------------- akışlar

type Flow = (r: Rec, p: Page) => Promise<void>;

/** Parsel adımı (drone, bitmiş hali, inşaat). */
async function parcelStep(r: Rec, p: Page) {
  r.chapter("Parsel dosyasını yükleyin");
  await sleep(700);
  await r.upload(p.getByText("Parsel dosyasını sürükleyin ya da seçin"), [PARCEL]);
  const next = p.getByRole("button", { name: "Devam →" }).first();
  await next.waitFor({ timeout: 20_000 });
  await r.moveTo(p.locator(".card", { hasText: "Ezine" }).first(), 0.3, 0.5);
  await sleep(1400);
  await r.click(next);
}

async function listingFields(r: Rec, p: Page, price: string) {
  await r.type(p.locator("#price"), price);
  await r.type(p.locator("#office"), OFFICE);
  await r.type(p.locator("#phone"), PHONE);
}

const flows: Record<string, Flow> = {
  "arsa-drone": async (r, p) => {
    await parcelStep(r, p);

    r.chapter("Yakın noktaları seçin");
    const suggested = p.locator(".card", { hasText: "Önerilen noktalar" });
    const others = p.locator(".card", { hasText: "Diğer yakın yerler" });
    // Çevre taraması ve harita yüklemesi videodan kesilir.
    await r.skip(async () => {
      await p.waitForFunction(() => !document.body.innerText.includes("Çevre taranıyor"), null, { timeout: 60_000 });
      await p.locator(".gm-style").first().waitFor({ timeout: 30_000 }).catch(() => {});
      await sleep(3500); // harita karoları ve işaretler
    });
    await r.moveTo(p.locator(".gm-style").first(), 0.55, 0.45);
    await sleep(1600);
    const list = (await suggested.count()) ? suggested : others;
    for (let i = 0; i < 3; i++) {
      const btn = list.locator("button:not([disabled])").first();
      if (!(await btn.count())) break;
      await r.click(btn, 0.35);
      await sleep(500);
    }
    await r.moveTo(p.locator(".card", { hasText: "Videoda anlatılacak noktalar" }), 0.5, 0.4);
    await sleep(900);
    r.posterHere();
    await r.click(p.getByRole("button", { name: "Devam →" }));

    r.chapter("Fiyat ve ofis bilgilerini girin");
    await sleep(400);
    await r.type(p.locator("#price"), "4250000");
    await r.type(p.locator("#zoning"), "Zeytinlik, köye yakın");
    await r.type(p.locator("#office"), OFFICE);
    await r.type(p.locator("#phone"), PHONE);
    await r.click(p.getByRole("button", { name: "Devam →" }));

    r.chapter("Sesi ve müziği seçin");
    const voices = p.locator(".card", { hasText: "Seslendirme" }).locator("div.cursor-pointer");
    await voices.first().waitFor({ timeout: 20_000 }).catch(() => {});
    await sleep(500);
    if ((await voices.count()) > 1) await r.click(voices.nth(1), 0.6);
    await r.moveTo(p.locator("label.card", { hasText: "Fon müziği" }), 0.6);
    await sleep(600);
    await r.hoverSubmit();
  },

  "ilan-videosu": async (r, p) => {
    r.chapter("İlan fotoğraflarını yükleyin");
    await sleep(700);
    await r.upload(p.getByText("Fotoğrafları sürükleyin ya da seçin"), [VILLA("02"), VILLA("11"), VILLA("17"), VILLA("21")]);
    await p.getByLabel("4. sahne başlığı").waitFor();
    await sleep(900);

    // Sıra videodaki sırayı belirler; mekân tipi fotoğraf başına seçilir.
    await r.moveTo(p.locator("ol li").first().locator("img"), 0.5, 0.5);
    await sleep(900);
    await r.click(p.locator("ol li").nth(1).getByRole("radio", { name: "İç mekân" }));
    await sleep(600);

    r.chapter("Sahne başlıklarını yazın");
    const titles = ["Bahçeli villa", "Geniş salon", "Yatak odası", "Banyo"];
    for (const [i, t] of titles.entries()) await r.type(p.getByLabel(`${i + 1}. sahne başlığı`), t, 45);
    r.posterHere();
    await sleep(500);

    r.chapter("Fiyat ve iletişim bilgisini girin");
    await listingFields(r, p, "14500000");
    if (!(await p.getByRole("button", { name: "Videoyu oluştur" }).isEnabled().catch(() => false)))
      await r.skip(() => p.getByRole("button", { name: "Videoyu oluştur" }).and(p.locator(":enabled")).waitFor({ timeout: 90_000 }));
    await r.hoverSubmit();
  },

  "bitmis-hali": async (r, p) => {
    await parcelStep(r, p);

    r.chapter("Yapı tipini ve kat sayısını seçin");
    await sleep(500);
    for (const t of ["Villa", "Villa sitesi", "Ticari bina"]) {
      await r.moveTo(p.locator("label", { hasText: t }).first(), 0.4);
      await sleep(650);
    }
    await r.click(p.locator("label", { hasText: "Apartman" }));
    await sleep(400);
    await r.select(p.locator("#floors"), "5");
    r.posterHere();
    await sleep(600);

    r.chapter("Fiyat ve iletişim bilgisini girin");
    await listingFields(r, p, "4250000");
    await r.moveTo(p.locator("label", { hasText: "Fon müziği" }), 0.9);
    await sleep(700);
    await r.hoverSubmit();
  },

  "insaat-videosu": async (r, p) => {
    await parcelStep(r, p);

    r.chapter("Yapı tipini ve kat sayısını seçin");
    await sleep(500);
    await r.click(p.locator("label", { hasText: "Apartman" }));
    await r.select(p.locator("#floors"), "5");

    r.chapter("Emsal ve TAKS değerlerini girin");
    await r.type(p.locator("#emsal"), "1,20");
    await r.type(p.locator("#taks"), "0,30");
    await r.moveTo(p.getByText("m² inşaat alanı"), 0.5);
    r.posterHere();
    await sleep(1300);

    r.chapter("Kapanış kartını doldurun");
    await listingFields(r, p, "4250000");
    const voices = p.locator(".card", { hasText: "Seslendirme" }).locator("div.cursor-pointer");
    if ((await voices.count()) > 1) await r.click(voices.nth(1), 0.6);
    await r.hoverSubmit();
  },

  "dosenmis-ev": async (r, p) => {
    r.chapter("Boş oda fotoğraflarını yükleyin");
    await sleep(700);
    await r.upload(p.getByText("Oda fotoğraflarını sürükleyin ya da seçin"), [DAIRE("01"), DAIRE("x-20h"), DAIRE("x-t29")]);
    await p.getByLabel("3. oda tipi").waitFor();
    await sleep(800);

    r.chapter("Oda tipini ve döşeme tarzını seçin");
    await r.select(p.getByLabel("1. oda tipi"), "salon");
    await r.select(p.getByLabel("2. oda tipi"), "yatak_odasi");
    await r.select(p.getByLabel("3. oda tipi"), "calisma_odasi");
    r.posterHere();
    await r.click(p.locator("label", { hasText: "İskandinav" }));
    await sleep(400);

    r.chapter("İlan bilgilerini girin");
    await r.type(p.locator("#kind"), "Satılık Daire", 42);
    await r.type(p.locator("#location"), "Ataşehir", 42);
    await r.type(p.locator("#rooms"), "3+1", 60);
    await r.type(p.locator("#netm2"), "135", 60);
    await r.moveTo(p.locator(".card", { hasText: "Anlatım metni" }).first(), 0.5, 0.3);
    await sleep(1200);

    r.chapter("Fiyat ve iletişim bilgisini girin");
    await listingFields(r, p, "8750000");
    if (!(await p.getByRole("button", { name: "Videoyu oluştur" }).isEnabled().catch(() => false)))
      await r.skip(() => p.getByRole("button", { name: "Videoyu oluştur" }).and(p.locator(":enabled")).waitFor({ timeout: 90_000 }));
    await r.hoverSubmit();
  },

  "sunucu-ev": async (r, p) => {
    r.chapter("Oda fotoğraflarını yükleyin");
    await sleep(700);
    await r.upload(p.getByText("Oda fotoğraflarını sürükleyin ya da seçin"), [VILLA("01"), VILLA("13"), VILLA("18")]);
    await p.getByLabel("3. oda tipi").waitFor();
    await sleep(800);

    r.chapter("Oda tiplerini seçin");
    await r.select(p.getByLabel("1. oda tipi"), "dis_cephe");
    await r.select(p.getByLabel("2. oda tipi"), "salon");
    await r.select(p.getByLabel("3. oda tipi"), "yatak_odasi");
    await r.moveTo(p.getByLabel("2. sahnede sunucunun söyleyeceği"), 0.5, 0.5);
    r.posterHere();
    await sleep(1200);

    r.chapter("İlan bilgilerini girin");
    await r.type(p.locator("#kind"), "Satılık Villa", 42);
    await r.type(p.locator("#location"), "Etimesgut Bağlıca", 42);
    await r.type(p.locator("#rooms"), "4+1", 60);
    await r.type(p.locator("#netm2"), "220", 60);

    // Konumdan yakın yerler gelince sayfa biraz uzar; tıklamadan önce yerleşsin.
    await r.skip(() => p.getByText("Yakın yerler:").waitFor({ timeout: 20_000 }).catch(() => {}));

    r.chapter("Sunucuyu seçin");
    const murat = p.locator("label", { has: p.locator('input[name="presenter"][value="murat"]') });
    await r.click(murat, 0.5, 0.4);
    if (!(await murat.locator("input").isChecked())) await murat.locator("input").check({ force: true });
    await sleep(900);
    await listingFields(r, p, "14500000");
    if (!(await p.getByRole("button", { name: "Videoyu oluştur" }).isEnabled().catch(() => false)))
      await r.skip(() => p.getByRole("button", { name: "Videoyu oluştur" }).and(p.locator(":enabled")).waitFor({ timeout: 90_000 }));
    await r.hoverSubmit();
  },
};

/** Sonuç bölümü: örnek video (9:16) koyu zeminde ortada; video yoksa kapak. */
const RESULT: Record<string, { video?: string; poster?: string; seconds: number }> = {
  "arsa-drone": { video: "ornek-reel.mp4", seconds: 7 },
  "ilan-videosu": { video: "sablon-ilan.mp4", seconds: 7 },
  "bitmis-hali": { poster: "sablon-bitmis-poster.jpg", seconds: 4 },
  "insaat-videosu": { video: "sablon-insaat.mp4", seconds: 7 },
  "dosenmis-ev": { video: "sablon-dosenmis.mp4", seconds: 7 },
  "sunucu-ev": { video: "sablon-sunucu.mp4", seconds: 7 },
};

// ---------------------------------------------------------------- kayıt + kurgu

async function record(browser: Browser, storageState: any, id: string) {
  const dir = path.join(TMP, id);
  const ctx = await browser.newContext({
    viewport: { width: W, height: H },
    deviceScaleFactor: 1,
    storageState,
    locale: "tr-TR",
    recordVideo: { dir, size: { width: W, height: H } },
  });
  await ctx.addInitScript({ content: CURSOR_SCRIPT });
  // Örnek ses çalınmasın (ElevenLabs çağrısı) ve sipariş kesinlikle açılmasın.
  await ctx.route("**/api/videos", (route) => (route.request().method() === "POST" ? route.abort() : route.continue()));
  await ctx.route("**/api/voices/sample", (route) => route.abort());
  const page = await ctx.newPage();
  const r = new Rec(page);
  await page.goto(`${BASE}/panel/yeni/${id}`, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.mouse.move(r.x, r.y);
  // Eşitleme işareti: kısa bir magenta kare; ham videoda bulunup betik saatiyle video saati arasındaki kayma ölçülür
  // (kesilen baş kısımda kalır, son videoda görünmez).
  await sleep(400);
  await page.evaluate(() => {
    const d = document.createElement("div");
    d.id = "__sync";
    d.style.cssText = "position:fixed;inset:0;background:#ff00ff;z-index:2147483647";
    document.body.appendChild(d);
  });
  await sleep(120);
  const syncAt = r.now();
  await sleep(400);
  await page.evaluate(() => document.getElementById("__sync")?.remove());
  await sleep(700);
  r.start();
  await flows[id]!(r, page);
  r.cut();
  const video = page.video()!;
  await ctx.close();
  const raw = await video.path();
  // Video, sayfa açılışından biraz sonra başlar: magenta karenin videodaki ilk anı ile betikteki anı arasındaki fark.
  const px = execFileSync(FFMPEG, ["-loglevel", "error", "-t", "30", "-i", raw, "-vf", `fps=${FPS},scale=1:1,format=rgb24`, "-f", "rawvideo", "-"], { maxBuffer: 1 << 24 });
  let first = -1;
  for (let i = 0; i + 2 < px.length; i += 3) {
    if (px[i]! > 200 && px[i + 1]! < 90 && px[i + 2]! > 200) {
      first = i / 3;
      break;
    }
  }
  if (first < 0) throw new Error(`${id}: eşitleme karesi ham videoda bulunamadı`);
  // Kare ekrana ~1 kare geç düşer; boyandığı an evaluate dönüşünden önce olduğu için syncAt'tan 120 ms geri sayılır.
  const offset = syncAt - 0.12 - first / FPS;
  console.log(`  eşitleme: betik ${syncAt.toFixed(2)} sn, video ${(first / FPS).toFixed(2)} sn → kayma ${offset.toFixed(2)} sn`);
  return { r, raw, offset };
}

function compose(id: string, r: Rec, raw: string, offset: number) {
  const res = RESULT[id]!;
  const mp4 = path.join(OUT, `${id}.mp4`);
  const segs = r.segs.filter((s) => s.to !== undefined && s.to - s.from > 0.05);
  const n = segs.length;
  const parts = [
    `[0:v]split=${n}${segs.map((_, i) => `[v${i}]`).join("")}`,
    ...segs.map((s, i) => `[v${i}]trim=start=${Math.max(0, s.from - offset).toFixed(3)}:end=${(s.to! - offset).toFixed(3)},setpts=PTS-STARTPTS,fps=${FPS},scale=${W}:${H},setsar=1,format=yuv420p[s${i}]`),
    `[1:v]trim=duration=${res.seconds},setpts=PTS-STARTPTS,fps=${FPS},scale=-2:${H},pad=${W}:${H}:(ow-iw)/2:0:color=0x121a16,setsar=1,format=yuv420p,fade=t=in:st=0:d=0.35[res]`,
    `${segs.map((_, i) => `[s${i}]`).join("")}[res]concat=n=${n + 1}:v=1:a=0,scale=out_range=tv,format=yuv420p[out]`,
  ];
  const second = res.video ? ["-i", path.join(MEDIA, res.video)] : ["-loop", "1", "-framerate", String(FPS), "-t", String(res.seconds), "-i", path.join(MEDIA, res.poster!)];
  execFileSync(FFMPEG, [
    "-y", "-loglevel", "error",
    "-i", raw, ...second,
    "-filter_complex", parts.join(";"),
    "-map", "[out]", "-an",
    "-c:v", "libx264", "-preset", "slow", "-crf", "26", "-pix_fmt", "yuv420p", "-color_range", "tv", "-movflags", "+faststart",
    mp4,
  ]);
  // Kapak: formun dolu olduğu bir an.
  const jpg = path.join(OUT, `${id}.jpg`);
  const at = r.final(r.poster || r.marks.at(-1)!.t);
  for (const q of [4, 6, 8, 11, 15]) {
    execFileSync(FFMPEG, ["-y", "-loglevel", "error", "-ss", at.toFixed(2), "-i", mp4, "-frames:v", "1", "-q:v", String(q), jpg]);
    if (fs.statSync(jpg).size < 150_000) break;
  }
  const formLen = r.formLength();
  const chapters = r.marks.map((m) => ({ t: Math.round(r.final(m.t) * 10) / 10, label: m.label }));
  chapters[0]!.t = 0;
  chapters.push({ t: Math.round(formLen * 10) / 10, label: "Video hazır" });
  return { mp4, jpg, formLen, total: formLen + res.seconds, chapters };
}

async function main() {
  const ids = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(flows);
  const email = process.env.LOCAL_TEST_EMAIL;
  const password = process.env.LOCAL_TEST_PASSWORD;
  if (!email || !password) throw new Error("LOCAL_TEST_EMAIL / LOCAL_TEST_PASSWORD gerekli (kök .env)");
  if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE)) throw new Error("Kayıt yalnız yerel sunucuda yapılır");
  fs.mkdirSync(OUT, { recursive: true });

  // Playwright'ın video kaydı ffmpeg ister: indirmek yerine sistemdeki ffmpeg geçici bir kayıt dizininden gösterilir.
  if (!process.env.PLAYWRIGHT_BROWSERS_PATH) {
    const rev = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, "../node_modules/playwright-core/browsers.json"), "utf8"))
      .browsers.find((b: { name: string }) => b.name === "ffmpeg").revision;
    const dir = path.join(TMP, "pw", `ffmpeg-${rev}`);
    fs.mkdirSync(dir, { recursive: true });
    fs.symlinkSync(FFMPEG, path.join(dir, process.platform === "darwin" ? "ffmpeg-mac" : "ffmpeg-linux"));
    process.env.PLAYWRIGHT_BROWSERS_PATH = path.join(TMP, "pw");
  }
  const { chromium } = await import("playwright-core");
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const login = await browser.newContext({ viewport: { width: W, height: H } });
  const lp = await login.newPage();
  await lp.goto(`${BASE}/giris`, { waitUntil: "networkidle" });
  await lp.fill("#email", email);
  await lp.fill("#password", password);
  await lp.click("button.btn-primary");
  await lp.waitForURL(/\/panel/, { timeout: 30_000 });
  const storageState = await login.storageState();
  await login.close();

  const all: Record<string, { t: number; label: string }[]> = fs.existsSync(CHAPTERS) ? JSON.parse(fs.readFileSync(CHAPTERS, "utf8")) : {};
  for (const id of ids) {
    if (!flows[id]) throw new Error(`Bilinmeyen şablon: ${id}`);
    console.log(`▶ ${id}`);
    const { r, raw, offset } = await record(browser, storageState, id);
    const out = compose(id, r, raw, offset);
    all[id] = out.chapters;
    console.log(
      `  ${path.relative(ROOT, out.mp4)} ${(fs.statSync(out.mp4).size / 1e6).toFixed(2)} MB · form ${out.formLen.toFixed(1)} sn + sonuç = ${out.total.toFixed(1)} sn · kapak ${(fs.statSync(out.jpg).size / 1e3).toFixed(0)} KB`,
    );
    for (const c of out.chapters) console.log(`    ${c.t.toFixed(1).padStart(5)}  ${c.label}`);
  }
  await browser.close();

  const ordered = Object.fromEntries(Object.keys(flows).filter((k) => all[k]).map((k) => [k, all[k]]));
  fs.writeFileSync(CHAPTERS, JSON.stringify(ordered, null, 2) + "\n");
  console.log(`bölümler → ${path.relative(ROOT, CHAPTERS)}`);
}

await main();
