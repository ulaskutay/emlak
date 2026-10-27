"use client";
import type { VoiceOption } from "@arsa/providers";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ParcelShape } from "@/components/ParcelShape";
import { formatArea, parcelPlace, parcelTitle } from "@/lib/format";
import { PoiStep, type PoiItem } from "./PoiStep";
import { ParcelMap, TkgmQuery } from "./TkgmQuery";

type Summary = {
  areaM2: number;
  ada?: string;
  parsel?: string;
  nitelik?: string;
  il?: string;
  ilce?: string;
  mahalle?: string;
  centroid: { lat: number; lng: number };
};
export type Parsed = { fileName: string; text: string; summary: Summary; ring: { lat: number; lng: number }[]; hook: string };

const STEPS = ["Parsel", "Yakın noktalar", "İlan bilgileri", "Ses ve müzik"];
export const OFFICE_KEY = "arsa-video:office";

export function Wizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [parcel, setParcel] = useState<Parsed | null>(null);
  const [listing, setListing] = useState({ price: "", zoning: "", officeName: "", phone: "" });
  const [voiceId, setVoiceId] = useState<string | null>(null);
  // Videoya yalnızca kullanıcının seçtiği noktalar girer (boşsa yalnızca parsel anlatılır).
  const [pois, setPois] = useState<PoiItem[]>([]);
  const [music, setMusic] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Ofis adı ve telefon her videoda aynı: tarayıcıda hatırlanır.
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(OFFICE_KEY) ?? "{}");
      setListing((l) => ({ ...l, officeName: saved.officeName ?? "", phone: saved.phone ?? "" }));
    } catch {}
  }, []);

  async function submit() {
    if (!parcel) return;
    setBusy(true);
    setError(null);
    try {
      localStorage.setItem(OFFICE_KEY, JSON.stringify({ officeName: listing.officeName, phone: listing.phone }));
    } catch {}
    const price = Number(listing.price.replace(/\D/g, ""));
    const res = await fetch("/api/videos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        template: "arsa-drone",
        parcelFileName: parcel.fileName,
        parcelText: parcel.text,
        listing: {
          ...(price ? { priceTry: price } : {}),
          ...(listing.zoning.trim() ? { zoning: listing.zoning.trim() } : {}),
          ...(listing.officeName.trim() ? { officeName: listing.officeName.trim() } : {}),
          ...(listing.phone.trim() ? { phone: listing.phone.trim() } : {}),
          pois,
        },
        ...(voiceId ? { voiceId } : {}),
        music,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setError(data.error ?? "Video oluşturulamadı");
    router.push(`/panel/videolar/${data.id}`);
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-[1.75rem] font-extrabold leading-tight tracking-[-0.03em] sm:text-[2rem]">Arsa drone turu</h1>
      <ol className="mt-5 mb-6 grid grid-cols-4 gap-2 sm:mt-6 sm:mb-8 sm:gap-3" aria-label="Adımlar">
        {STEPS.map((s, i) => (
          <li key={s} aria-current={i === step ? "step" : undefined} className="min-w-0">
            <div className={`h-1.5 rounded-full ${i <= step ? "bg-gok" : "bg-ayrac"}`} />
            <div className={`mt-2 flex items-center gap-1.5 text-sm font-semibold ${i === step ? "text-lacivert" : i < step ? "text-gok" : "text-gri"}`}>
              <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[0.6875rem] font-bold ${i < step ? "bg-gok text-white" : i === step ? "bg-lacivert text-white" : "bg-ayrac text-gri"}`}>
                {i < step ? "✓" : i + 1}
              </span>
              <span className={`truncate ${i === step ? "" : "hidden sm:inline"}`}>{s}</span>
            </div>
          </li>
        ))}
      </ol>

      {step === 0 && (
        <ParcelStep
          parcel={parcel}
          onParsed={(p) => (setParcel(p), setPois([]))} // yeni parselde seçim baştan
          onNext={() => setStep(1)}
        />
      )}

      {step === 1 && parcel && (
        <PoiStep
          key={parcel.fileName + parcel.summary.centroid.lat}
          center={parcel.summary.centroid}
          ring={parcel.ring}
          district={parcel.summary.ilce}
          province={parcel.summary.il}
          neighbourhood={parcel.summary.mahalle}
          selected={pois}
          onChange={setPois}
          onBack={() => setStep(0)}
          onNext={() => setStep(2)}
        />
      )}

      {step === 2 && (
        <div className="pnl-kart space-y-5 p-5 sm:p-6">
          <p className="text-sm text-gri">
            Hepsi isteğe bağlı. Fiyat videonun sonunda okunur ve kapanış kartında yazar; telefon yalnızca kartta görünür.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="pnl-label" htmlFor="price">Fiyat (TL)</label>
              <input id="price" className="pnl-input" inputMode="numeric" placeholder="Örn. 12.500.000" value={listing.price}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "").slice(0, 12);
                  setListing({ ...listing, price: digits ? Number(digits).toLocaleString("tr-TR") : "" });
                }} />
            </div>
            <div>
              <label className="pnl-label" htmlFor="zoning">İmar durumu</label>
              <input id="zoning" className="pnl-input" maxLength={80} placeholder="Örn. Konut imarlı" value={listing.zoning}
                onChange={(e) => setListing({ ...listing, zoning: e.target.value })} />
            </div>
            <div>
              <label className="pnl-label" htmlFor="office">Ofis adı</label>
              <input id="office" className="pnl-input" maxLength={60} placeholder="Örn. Etic Emlak" value={listing.officeName}
                onChange={(e) => setListing({ ...listing, officeName: e.target.value })} />
            </div>
            <div>
              <label className="pnl-label" htmlFor="phone">Telefon</label>
              <input id="phone" className="pnl-input" maxLength={20} inputMode="tel" placeholder="0532 000 00 00" value={listing.phone}
                onChange={(e) => setListing({ ...listing, phone: e.target.value.replace(/[^0-9+ ()-]/g, "") })} />
            </div>
          </div>
          <div className="flex justify-between gap-3">
            <button className="pnl-btn-ghost" onClick={() => setStep(1)}>← Geri</button>
            <button className="pnl-btn-primary" onClick={() => setStep(3)}>Devam →</button>
          </div>
        </div>
      )}

      {step === 3 && parcel && (
        <div className="space-y-4">
          <VoiceStep hook={parcel.hook} voiceId={voiceId} onSelect={setVoiceId} />
          <label className="pnl-kart flex cursor-pointer items-center justify-between p-5">
            <span>
              <span className="block font-semibold">Fon müziği</span>
              <span className="text-sm text-gri">Sinematik müzik; anlatım sırasında otomatik kısılır</span>
            </span>
            <input type="checkbox" className="h-5 w-5 accent-[#2b6cff]" checked={music} onChange={(e) => setMusic(e.target.checked)} />
          </label>
          {error && <p className="rounded-lg bg-mercan-acik px-3 py-2 text-sm text-mercan-koyu">{error}</p>}
          <div className="flex justify-between gap-3">
            <button className="pnl-btn-ghost" onClick={() => setStep(2)}>← Geri</button>
            <button className="pnl-btn-primary" disabled={busy} onClick={submit}>{busy ? "Gönderiliyor…" : "Videoyu oluştur"}</button>
          </div>
        </div>
      )}
    </div>
  );
}

export function ParcelStep({ parcel, onParsed, onNext }: { parcel: Parsed | null; onParsed: (p: Parsed | null) => void; onNext: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [mode, setMode] = useState<"tkgm" | "dosya">("tkgm");
  const input = useRef<HTMLInputElement>(null);

  async function load(file: File) {
    setError(null);
    if (!/\.(geojson|json|kml)$/i.test(file.name)) return setError("TKGM'den indirilen .geojson, .json ya da .kml dosyası seçin");
    if (file.size > 2_000_000) return setError("Dosya çok büyük (en fazla 2 MB)");
    setBusy(true);
    const text = await file.text();
    const res = await fetch("/api/parcel/parse", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return (setError(data.error ?? "Dosya okunamadı"), onParsed(null));
    onParsed({ fileName: file.name, text, ...data });
  }

  return (
    <div className="space-y-4">
      <div className="inline-flex w-full rounded-xl border border-ayrac bg-white p-1 sm:w-auto" role="tablist">
        {([["tkgm", "TKGM'den sorgula"], ["dosya", "Dosya yükle"]] as const).map(([m, label]) => (
          <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => (setMode(m), setError(null))}
            className={`min-h-10 flex-1 rounded-lg px-4 text-sm font-bold transition sm:flex-none ${mode === m ? "bg-lacivert text-white" : "text-gri hover:text-lacivert"}`}>
            {label}
          </button>
        ))}
      </div>
      {mode === "tkgm" && <TkgmQuery onParsed={onParsed} />}
      {mode === "dosya" && (
        <div
          className={`pnl-kart grid cursor-pointer place-items-center border-dashed p-10 text-center transition ${drag ? "border-gok bg-gok-acik/60" : "hover:border-gok/50"}`}
          onClick={() => input.current?.click()}
          onDragOver={(e) => (e.preventDefault(), setDrag(true))}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            const f = e.dataTransfer.files[0];
            if (f) load(f);
          }}
        >
          <input ref={input} type="file" accept=".geojson,.json,.kml" hidden onChange={(e) => e.target.files?.[0] && load(e.target.files[0])} />
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gok-acik text-2xl">📍</span>
          <div className="mt-3 font-semibold">{busy ? "Okunuyor…" : "Parsel dosyasını sürükleyin ya da seçin"}</div>
          <div className="mt-1 text-sm text-gri">TKGM Parsel Sorgu → Dışa aktar → GeoJSON veya KML</div>
        </div>
      )}
      {error && <p className="rounded-lg bg-mercan-acik px-3 py-2 text-sm text-mercan-koyu">{error}</p>}
      {parcel && (
        <div className="pnl-kart space-y-4 p-5">
          <ParcelMap key={parcel.fileName} ring={parcel.ring} />
          <div className="flex flex-wrap items-center gap-4 sm:flex-nowrap sm:gap-5">
            <ParcelShape ring={parcel.ring} className="h-24 w-24 shrink-0 sm:h-28 sm:w-28" />
            <div className="min-w-0 flex-1">
              <div className="text-lg font-extrabold">{parcelTitle(parcel.summary)}</div>
              <div className="text-sm text-gri">{parcelPlace(parcel.summary)}</div>
              <div className="mt-2 text-2xl font-extrabold text-gok">{formatArea(parcel.summary.areaM2)}</div>
              <div className="mt-1 truncate text-xs text-gri">{parcel.fileName}</div>
            </div>
            <button className="pnl-btn-primary w-full sm:w-auto" onClick={onNext}>Devam →</button>
          </div>
        </div>
      )}
    </div>
  );
}

export function VoiceStep({ hook, voiceId, onSelect }: { hook: string; voiceId: string | null; onSelect: (id: string) => void }) {
  const [voices, setVoices] = useState<VoiceOption[] | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    fetch("/api/voices")
      .then((r) => r.json())
      .then((d: { voices: VoiceOption[] }) => {
        const native = d.voices.filter((v) => v.native);
        const list = native.length ? native : d.voices;
        setVoices(list);
        if (!voiceId && list[0]) onSelect(list[0].id);
      });
    return () => audio.current?.pause();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function play(id: string) {
    audio.current?.pause();
    if (playing === id) return setPlaying(null);
    setLoading(id);
    const res = await fetch("/api/voices/sample", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ voiceId: id, text: hook }) });
    const data = await res.json();
    setLoading(null);
    if (!res.ok) return;
    audio.current = new Audio(data.url);
    audio.current.onended = () => setPlaying(null);
    await audio.current.play();
    setPlaying(id);
  }

  return (
    <div className="pnl-kart p-5">
      <div className="mb-1 font-semibold">Seslendirme</div>
      <p className="mb-4 text-sm text-gri">
        Örnek cümle: <span className="text-lacivert">“{hook}”</span>
      </p>
      {!voices && <div className="text-sm text-gri">Sesler yükleniyor…</div>}
      {voices && !voices.length && <div className="text-sm text-[#8a5d00]">Seslendirme ayarlı değil; video seslendirmesiz üretilecek.</div>}
      <div className="grid gap-3 sm:grid-cols-2">
        {voices?.map((v) => (
          <div key={v.id} onClick={() => onSelect(v.id)}
            className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition ${voiceId === v.id ? "border-gok bg-gok-acik" : "border-ayrac hover:border-gok/40"}`}>
            <button type="button" aria-label={`${v.name} örneğini dinle`}
              onClick={(e) => (e.stopPropagation(), play(v.id))}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-zemin text-sm hover:bg-gok hover:text-white">
              {loading === v.id ? "…" : playing === v.id ? "■" : "▶"}
            </button>
            <div className="min-w-0">
              <div className="font-semibold">
                {v.name} <span className="text-xs font-normal text-gri">{v.gender === "female" ? "Kadın" : v.gender === "male" ? "Erkek" : ""}</span>
              </div>
              <div className="line-clamp-2 text-xs text-gri">{v.description}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
