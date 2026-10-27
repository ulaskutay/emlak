"use client";
import { BUILDING_LABELS, BuildingType, TEMPLATES } from "@arsa/shared";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ListingFields, listingPayload, type ListingValues } from "./ListingFields";
import { ParcelStep, type Parsed } from "./Wizard";

const TYPES = BuildingType.options;
const HINTS: Record<BuildingType, string> = {
  konut: "Kat sayısını siz seçersiniz",
  villa: "İki katlı, havuzlu tek villa",
  villa_sitesi: "Büyük arsalar için birden çok villa",
  ticari: "Cam cepheli ofis, zeminde dükkânlar",
};

const INTRO = {
  "bitmis-hali": "Parselin drone çekiminin ardından, aynı kareden seçtiğiniz yapının yükseldiği bir inşaat sahnesi. Görüntü temsilidir; videoda bu yazılır.",
  "insaat-videosu": "Parselin drone çekiminin son karesinden yapay zekâ inşaatı doğrudan kurar: kazı, kaba inşaat ve bitmiş yapı. Görüntü temsilidir; videoda bu yazılır.",
};

/** Bitmiş hali ve arsadan inşaat videosu: aynı girdi (parsel + yapı tipi), farklı üretim hattı. */
export function BitmisForm({ template }: { template: keyof typeof INTRO }) {
  const router = useRouter();
  const [parcel, setParcel] = useState<Parsed | null>(null);
  const [step, setStep] = useState(0);
  const [building, setBuilding] = useState<BuildingType>("konut");
  const [floors, setFloors] = useState(4);
  const [listing, setListing] = useState<ListingValues>({ price: "", officeName: "", phone: "" });
  const [music, setMusic] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!parcel) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/videos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        template,
        parcelFileName: parcel.fileName,
        parcelText: parcel.text,
        building,
        floors,
        listing: listingPayload(listing),
        music,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setError(data.error ?? "Video oluşturulamadı");
    router.push(`/panel/videolar/${data.id}`);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-[1.75rem] font-extrabold leading-tight tracking-[-0.03em] sm:text-[2rem]">{TEMPLATES[template].name}</h1>
        <p className="mt-2 text-gri">
          {INTRO[template]}
        </p>
      </div>

      {step === 0 && <ParcelStep parcel={parcel} onParsed={setParcel} onNext={() => setStep(1)} />}

      {step === 1 && parcel && (
        <>
          <fieldset className="pnl-kart p-5 sm:p-6">
            <legend className="sr-only">Yapı tipi</legend>
            <div className="mb-4 font-semibold">Arsaya ne yapılsın?</div>
            <div className="grid gap-3 sm:grid-cols-2">
              {TYPES.map((t) => (
                <label key={t}
                  className={`flex cursor-pointer flex-col rounded-xl border p-4 transition ${building === t ? "border-gok bg-gok-acik" : "border-ayrac hover:border-gok/50"}`}>
                  <input type="radio" name="building" value={t} className="sr-only" checked={building === t} onChange={() => setBuilding(t)} />
                  <span className="font-semibold">{BUILDING_LABELS[t]}</span>
                  <span className="mt-1 text-sm text-gri">{HINTS[t]}</span>
                </label>
              ))}
            </div>
            {(building === "konut" || building === "ticari") && (
              <div className="mt-5 max-w-xs">
                <label className="pnl-label" htmlFor="floors">Kat sayısı</label>
                <select id="floors" className="pnl-input" value={floors} onChange={(e) => setFloors(Number(e.target.value))}>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>{n} kat</option>
                  ))}
                </select>
              </div>
            )}
          </fieldset>

          <div className="pnl-kart space-y-4 p-5 sm:p-6">
            <p className="text-sm text-gri">Hepsi isteğe bağlı; videonun sonundaki kartta yazar. Fiyat girmezseniz arsanın alanı yazar.</p>
            <ListingFields value={listing} onChange={setListing} />
            <label className="flex cursor-pointer items-center justify-between border-t border-ayrac pt-4">
              <span>
                <span className="block font-semibold">Fon müziği</span>
                <span className="text-sm text-gri">Sinematik, sözsüz müzik</span>
              </span>
              <input type="checkbox" className="h-5 w-5 accent-[#2b6cff]" checked={music} onChange={(e) => setMusic(e.target.checked)} />
            </label>
          </div>

          {error && <p className="rounded-lg bg-mercan-acik px-3 py-2 text-sm text-mercan-koyu">{error}</p>}
          <div className="flex justify-between gap-3">
            <button className="pnl-btn-ghost" onClick={() => setStep(0)}>Geri</button>
            <button className="pnl-btn-primary" disabled={busy} onClick={submit}>{busy ? "Gönderiliyor…" : "Videoyu oluştur"}</button>
          </div>
        </>
      )}
    </div>
  );
}
