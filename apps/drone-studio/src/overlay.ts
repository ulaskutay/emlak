/**
 * Ekran katmanı (HTML, motordan bağımsız): kinetik başlık, konum etiketi, m² rozeti, özellik kutucukları,
 * altyazı, iletişim şeridi, kapanış kartı, kesme parlaması. index.html'deki öğeleri kare durumuna göre günceller.
 */
import { formatArea } from "@arsa/geo";
import type { FeatureChip, FrameState, ParcelInfo } from "./types.js";

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
export const easeOut = (t: number) => 1 - (1 - t) ** 3;
const $ = (id: string) => document.getElementById(id) as HTMLElement;

function setAnim(el: HTMLElement, p: number, dy = 26, dx = 0) {
  const e = easeOut(clamp01(p));
  el.style.opacity = String(e);
  el.style.transform = `translate(${(1 - e) * dx}px, ${(1 - e) * dy}px) scale(${0.94 + 0.06 * e})`;
}

/** Kelime kelime vurgulu altyazı; aynı parça içinde DOM yeniden kurulmaz (yalnız vurgu değişir). */
let captionKey = "";
function renderCaption(c: FrameState["caption"]) {
  const el = $("caption");
  if (!c) {
    el.style.opacity = "0";
    captionKey = "";
    return;
  }
  const key = c.words.join(" ");
  if (key !== captionKey) {
    el.innerHTML = "";
    for (const w of c.words) {
      const span = document.createElement("span");
      span.textContent = w;
      el.appendChild(span);
    }
    captionKey = key;
  }
  Array.from(el.children).forEach((n, i) => n.classList.toggle("on", i === c.active));
  const e = easeOut(clamp01(c.pop));
  el.style.opacity = String(e);
  el.style.transform = `translateY(${(1 - e) * 18}px) scale(${0.9 + 0.1 * e})`;
}

/** Açılış başlığı: satırlar sırayla, büyük ve eğik kayarak (kinetik tipografi). */
let hookKey = "";
function renderHook(h: FrameState["hook"]) {
  const el = $("hook");
  if (!h) return void (el.style.opacity = "0");
  const key = h.lines.join("|");
  if (key !== hookKey) {
    el.innerHTML = h.lines.map((_, i) => `<div class="line l${i}"></div>`).join("");
    el.querySelectorAll(".line").forEach((n, i) => (n.textContent = h.lines[i]!));
    hookKey = key;
  }
  el.style.opacity = "1";
  el.querySelectorAll<HTMLElement>(".line").forEach((n, i) => {
    const e = easeOut(clamp01(h.progress * 1.6 - i * 0.35));
    n.style.opacity = String(Math.min(e, h.progress * 3));
    n.style.transform = `translateX(${(1 - e) * (i % 2 ? 120 : -120)}px) skewX(${(1 - e) * -12}deg)`;
  });
}

/** Özellik kutucukları: soldan kayıp hafif zıplayarak gelir. */
let featKey = "";
function renderFeatures(list: FeatureChip[] | undefined) {
  const el = $("features");
  const items = list ?? [];
  const key = items.map((f) => `${f.icon}${f.label}${f.value}`).join("|");
  if (key !== featKey) {
    el.innerHTML = "";
    for (const f of items) {
      const chip = document.createElement("div");
      chip.className = "chip";
      chip.innerHTML = `<div class="icon"></div><div class="txt"><div class="lbl"></div><div class="val"></div></div>`;
      chip.querySelector(".icon")!.textContent = f.icon;
      chip.querySelector(".lbl")!.textContent = f.label;
      chip.querySelector(".val")!.textContent = f.value;
      el.appendChild(chip);
    }
    featKey = key;
  }
  Array.from(el.children).forEach((n, i) => {
    const p = items[i]?.progress ?? 0;
    const chip = n as HTMLElement;
    chip.style.display = p > 0.001 ? "" : "none"; // gelmeyenler yer kaplamasın
    chip.style.opacity = String(clamp01(p * 1.4));
    chip.style.transform = `translateX(${(1 - Math.min(1, p)) * -160}px) scale(${0.85 + 0.15 * p})`;
  });
}

export function renderOverlay(s: FrameState, parcel: ParcelInfo) {
  renderHook(s.hook ?? null);
  const place = $("place");
  if (s.place) {
    place.querySelector(".t")!.textContent = s.place.title;
    place.querySelector(".s")!.textContent = s.place.sub;
  }
  setAnim(place, s.place?.progress ?? 0, 30);
  const area = $("area");
  if (s.area) {
    area.querySelector(".num")!.textContent = formatArea(parcel.areaM2 * easeOut(clamp01(s.area.counter)));
    area.querySelector(".sub")!.textContent = s.area.sub ?? "";
  }
  setAnim(area, s.area?.progress ?? 0, -30);
  renderFeatures(s.features);
  $("flash").style.opacity = String(clamp01(s.flash ?? 0));
  const contact = $("contact");
  if (s.contact) {
    contact.querySelector(".office")!.textContent = s.contact.officeName ?? "";
    contact.querySelector(".phone")!.textContent = s.contact.phone ? `📞 ${s.contact.phone}` : "";
  }
  setAnim(contact, s.contact?.progress ?? 0, 30);
  renderCaption(s.caption ?? null);
  const end = $("endcard");
  if (s.endcard) {
    end.querySelector(".office")!.textContent = s.endcard.officeName ?? "";
    end.querySelector(".phone")!.textContent = s.endcard.phone ? `📞 ${s.endcard.phone}` : "";
    end.querySelector(".price")!.textContent = s.endcard.price ?? "";
  }
  setAnim(end, s.endcard?.progress ?? 0, 40);
}

/** Temiz kare (inşaat sahnesinin başlangıcı): tüm yazılar ve renk katmanları gizlenir. */
export function hideOverlay() {
  for (const id of ["hook", "place", "area", "features", "caption", "endcard", "contact", "flash", "vignette"]) $(id).style.opacity = "0";
}
