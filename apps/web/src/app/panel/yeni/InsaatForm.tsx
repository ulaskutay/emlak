"use client";
import { BUILDING_LABELS, BuildingType } from "@arsa/shared";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ListingFields, listingPayload, type ListingValues } from "./ListingFields";
import { uploadAgentPhoto, uploadLogo } from "./photoUpload";
import { ParcelStep, VoiceStep, type Parsed } from "./Wizard";

const TYPES = BuildingType.options;
const HINTS: Record<BuildingType, string> = {
  konut: "Kat sayısını siz seçersiniz",
  villa: "İki katlı, havuzlu tek villa",
  villa_sitesi: "Büyük arsalar için birden çok villa",
  ticari: "Cam cepheli ofis, zeminde dükkânlar",
};
const USES = ["Konut", "Ticari", "Konut + Ticari", "Turizm", "Sanayi"];

/** "1,20" ya da "1.20" → 1.2; boş/geçersiz → null. */
const decimal = (t: string) => {
  const n = Number(t.trim().replace(",", "."));
  return t.trim() && Number.isFinite(n) ? n : null;
};
type Asset = { key: string; url: string };

/** Görsel seçici: önizleme, yükleniyor durumu ve kaldırma düğmesi. */
function AssetPicker({ label, hint, value, round, upload, onChange }: {
  label: string;
  hint: string;
  value?: Asset;
  round?: boolean;
  upload: (f: File) => Promise<Asset>;
  onChange: (a?: Asset) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex items-center gap-4">
      <button type="button" onClick={() => input.current?.click()} disabled={busy}
        className={`grid h-20 w-20 shrink-0 place-items-center overflow-hidden border border-dashed border-ayrac text-xs text-gri transition hover:border-gok/60 ${round ? "rounded-full" : "rounded-xl bg-white"}`}>
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value.url} alt={label} className={round ? "h-full w-full object-cover" : "max-h-16 max-w-16 object-contain"} />
        ) : busy ? "Yükleniyor…" : "Seç"}
      </button>
      <div className="min-w-0">
        <div className="font-semibold">{label}</div>
        <div className="text-sm text-gri">{hint}</div>
        {value && (
          <button type="button" className="mt-1 text-sm text-gri underline hover:text-mercan-koyu" onClick={() => onChange(undefined)}>Kaldır</button>
        )}
        {error && <div className="mt-1 text-sm text-mercan-koyu">{error}</div>}
      </div>
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          setBusy(true);
          setError(null);
          try {
            onChange(await upload(f));
          } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
          } finally {
            setBusy(false);
          }
        }} />
    </div>
  );
}

export function InsaatForm() {
  const router = useRouter();
  const [parcel, setParcel] = useState<Parsed | null>(null);
  const [step, setStep] = useState(0);
  const [building, setBuilding] = useState<BuildingType>("konut");
  const [floors, setFloors] = useState(4);
  const [use, setUse] = useState("Konut");
  const [emsal, setEmsal] = useState("");
  const [taks, setTaks] = useState("");
  const [agentName, setAgentName] = useState("");
  const [photo, setPhoto] = useState<Asset>();
  const [logo, setLogo] = useState<Asset>();
  const [listing, setListing] = useState<ListingValues>({ price: "", officeName: "", phone: "" });
  const [voiceId, setVoiceId] = useState<string | null>(null);
  const [music, setMusic] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const e = decimal(emsal);
  const t = decimal(taks);
  const emsalOk = e !== null && e >= 0.05 && e <= 10;
  const taksOk = !taks.trim() || (t !== null && t > 0 && t <= 1);
  const area = parcel?.summary.areaM2 ?? 0;
  const fmt = (n: number) => Math.round(n).toLocaleString("tr-TR");

  async function submit() {
    if (!parcel || !emsalOk || !taksOk) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/videos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        template: "insaat-videosu",
        parcelFileName: parcel.fileName,
        parcelText: parcel.text,
        building,
        floors,
        zoning: { use: use.trim(), emsal: e, ...(t !== null && taks.trim() ? { taks: t } : {}) },
        agent: { ...(agentName.trim() && { name: agentName.trim() }), ...(photo && { photoKey: photo.key }), ...(logo && { logoKey: logo.key }) },
        listing: listingPayload(listing),
        ...(voiceId ? { voiceId } : {}),
        music,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setError(data.error ?? "Video oluşturulamadı");
    router.push(`/panel/videolar/${data.id}`);
  }

  const place = parcel ? [parcel.summary.ilce, parcel.summary.mahalle?.replace(/ (Mahallesi|Mah\.?|Köyü)$/i, "")].filter(Boolean).join(" ") : "";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-[1.75rem] font-extrabold leading-tight tracking-[-0.03em] sm:text-[2rem]">Arsadan inşaat videosu</h1>
        <p className="mt-2 text-gri">
          Arsa yandan, yakından görünür; temel kazılır, bina kat kat yükselir, peyzaj tamamlanır. Emsal, inşaat alanı ve TAKS ekranda yazar ve
          seslendirilir. Sonunda emlakçı kartı. Görüntü temsilidir; videoda bu yazılır. Hazırlanması 10–15 dakika sürer.
        </p>
      </div>

      {step === 0 && <ParcelStep parcel={parcel} onParsed={setParcel} onNext={() => setStep(1)} />}

      {step === 1 && parcel && (
        <>
          <fieldset className="pnl-kart p-5 sm:p-6">
            <legend className="sr-only">Yapı tipi</legend>
            <div className="mb-4 font-semibold">Arsaya ne yapılsın?</div>
            <div className="grid gap-3 sm:grid-cols-2">
              {TYPES.map((x) => (
                <label key={x}
                  className={`flex cursor-pointer flex-col rounded-xl border p-4 transition ${building === x ? "border-gok bg-gok-acik" : "border-ayrac hover:border-gok/50"}`}>
                  <input type="radio" name="building" value={x} className="sr-only" checked={building === x} onChange={() => setBuilding(x)} />
                  <span className="font-semibold">{BUILDING_LABELS[x]}</span>
                  <span className="mt-1 text-sm text-gri">{HINTS[x]}</span>
                </label>
              ))}
            </div>
            {(building === "konut" || building === "ticari") && (
              <div className="mt-5 max-w-xs">
                <label className="pnl-label" htmlFor="floors">Kat sayısı</label>
                <select id="floors" className="pnl-input" value={floors} onChange={(ev) => setFloors(Number(ev.target.value))}>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>{n} kat</option>
                  ))}
                </select>
              </div>
            )}
          </fieldset>

          <div className="pnl-kart space-y-4 p-5 sm:p-6">
            <div>
              <div className="font-semibold">İmar durumu</div>
              <p className="mt-1 text-sm text-gri">İmar durumu belgesindeki değerler. Videoda ekranda yazar ve seslendirilir.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="pnl-label" htmlFor="use">İmar türü</label>
                <input id="use" className="pnl-input" list="uses" maxLength={30} value={use} onChange={(ev) => setUse(ev.target.value)} />
                <datalist id="uses">{USES.map((u) => <option key={u} value={u} />)}</datalist>
              </div>
              <div>
                <label className="pnl-label" htmlFor="emsal">Emsal (KAKS)</label>
                <input id="emsal" className="pnl-input" inputMode="decimal" placeholder="Örn. 1,20" value={emsal}
                  onChange={(ev) => setEmsal(ev.target.value.replace(/[^0-9.,]/g, "").slice(0, 5))} />
              </div>
              <div>
                <label className="pnl-label" htmlFor="taks">TAKS (isteğe bağlı)</label>
                <input id="taks" className="pnl-input" inputMode="decimal" placeholder="Örn. 0,30" value={taks}
                  onChange={(ev) => setTaks(ev.target.value.replace(/[^0-9.,]/g, "").slice(0, 5))} />
              </div>
            </div>
            {emsal.trim() && !emsalOk && <p className="text-sm text-mercan-koyu">Emsal 0,05 ile 10 arasında olmalı</p>}
            {!taksOk && <p className="text-sm text-mercan-koyu">TAKS 0 ile 1 arasında olmalı</p>}
            {emsalOk && (
              <p className="rounded-lg bg-gok-acik px-3 py-2 text-sm">
                {fmt(area)} m² × {emsal.replace(".", ",")} = <b>{fmt(area * e!)} m² inşaat alanı</b>
                {t !== null && taksOk && taks.trim() ? <> · taban alanı {fmt(area * t)} m²</> : null}
              </p>
            )}
          </div>

          <div className="pnl-kart space-y-5 p-5 sm:p-6">
            <div>
              <div className="font-semibold">Kapanış kartı</div>
              <p className="mt-1 text-sm text-gri">Videonun son 4 saniyesi: fiyat, emlakçı, telefon ve ofis logosu. Hepsi isteğe bağlı.</p>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <AssetPicker label="Emlakçı fotoğrafı" hint="Yuvarlak kırpılır" round value={photo} upload={uploadAgentPhoto} onChange={setPhoto} />
              <AssetPicker label="Ofis logosu" hint="Saydam PNG en iyisi" value={logo} upload={uploadLogo} onChange={setLogo} />
            </div>
            <div className="max-w-xs">
              <label className="pnl-label" htmlFor="agent">Emlakçı adı</label>
              <input id="agent" className="pnl-input" maxLength={60} placeholder="Örn. Ümit G." value={agentName} onChange={(ev) => setAgentName(ev.target.value)} />
            </div>
            <ListingFields value={listing} onChange={setListing} />
            <label className="flex cursor-pointer items-center justify-between border-t border-ayrac pt-4">
              <span>
                <span className="block font-semibold">Fon müziği</span>
                <span className="text-sm text-gri">İnşaat seslerinin altında hafif müzik</span>
              </span>
              <input type="checkbox" className="h-5 w-5 accent-[#2b6cff]" checked={music} onChange={(ev) => setMusic(ev.target.checked)} />
            </label>
          </div>

          <VoiceStep hook={`${place ? `${place}, ` : ""}${fmt(area)} metrekare, ${use.toLocaleLowerCase("tr")} imarlı arsa.`} voiceId={voiceId} onSelect={setVoiceId} />

          {error && <p className="rounded-lg bg-mercan-acik px-3 py-2 text-sm text-mercan-koyu">{error}</p>}
          <div className="flex items-center justify-between gap-4">
            <button className="pnl-btn-ghost" onClick={() => setStep(0)}>Geri</button>
            <div className="flex items-center gap-4">
              {!emsalOk && <span className="text-sm text-gri">Emsali girin</span>}
              <button className="pnl-btn-primary" disabled={busy || !emsalOk || !taksOk || !use.trim()} onClick={submit}>
                {busy ? "Gönderiliyor…" : "Videoyu oluştur"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
