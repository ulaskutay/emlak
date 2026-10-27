"use client";
import { useEffect, useRef, useState } from "react";
import { loadMaps } from "@/lib/maps";
import type { Parsed } from "./Wizard";

type Option = { id: number; text: string };

async function list(tip: "il" | "ilce" | "mahalle", id?: number): Promise<Option[]> {
  const res = await fetch(`/api/parcel/tkgm?tip=${tip}${id ? `&id=${id}` : ""}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Liste alınamadı");
  return data.items;
}

/** TKGM Parsel Sorgu'daki gibi il → ilçe → mahalle → ada / parsel; bulunan parsel dosya yüklemeyle aynı biçimde döner. */
export function TkgmQuery({ onParsed }: { onParsed: (p: Parsed | null) => void }) {
  const [iller, setIller] = useState<Option[]>([]);
  const [ilceler, setIlceler] = useState<Option[]>([]);
  const [mahalleler, setMahalleler] = useState<Option[]>([]);
  const [il, setIl] = useState(0);
  const [ilce, setIlce] = useState(0);
  const [mahalle, setMahalle] = useState(0);
  const [ada, setAda] = useState("");
  const [parsel, setParsel] = useState("");
  const [loading, setLoading] = useState<string | null>("il");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    list("il")
      .then(setIller)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(null));
  }, []);

  function pickIl(id: number) {
    setIl(id), setIlce(0), setMahalle(0), setIlceler([]), setMahalleler([]), setError(null);
    if (!id) return;
    setLoading("ilce");
    list("ilce", id).then(setIlceler).catch((e) => setError(e.message)).finally(() => setLoading(null));
  }

  function pickIlce(id: number) {
    setIlce(id), setMahalle(0), setMahalleler([]), setError(null);
    if (!id) return;
    setLoading("mahalle");
    list("mahalle", id).then(setMahalleler).catch((e) => setError(e.message)).finally(() => setLoading(null));
  }

  async function search(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!mahalle) return setError("İl, ilçe ve mahalle seçin");
    if (!ada || !parsel) return setError("Ada ve parsel numarasını yazın");
    setBusy(true);
    const res = await fetch("/api/parcel/tkgm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mahalleId: mahalle, ada, parsel }),
    }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    setBusy(false);
    if (!res?.ok) return (setError(data?.error ?? "Parsel sorgulanamadı"), onParsed(null));
    onParsed(data);
  }

  const digits = (v: string) => v.replace(/\D/g, "").slice(0, 7);

  return (
    <form className="pnl-kart space-y-4 p-5" onSubmit={search}>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="pnl-label" htmlFor="tkgm-il">İl</label>
          <select id="tkgm-il" className="pnl-input" value={il} disabled={!iller.length} onChange={(e) => pickIl(Number(e.target.value))}>
            <option value={0}>{loading === "il" ? "Yükleniyor…" : "İl seçin"}</option>
            {iller.map((o) => <option key={o.id} value={o.id}>{o.text}</option>)}
          </select>
        </div>
        <div>
          <label className="pnl-label" htmlFor="tkgm-ilce">İlçe</label>
          <select id="tkgm-ilce" className="pnl-input" value={ilce} disabled={!ilceler.length} onChange={(e) => pickIlce(Number(e.target.value))}>
            <option value={0}>{loading === "ilce" ? "Yükleniyor…" : "İlçe seçin"}</option>
            {ilceler.map((o) => <option key={o.id} value={o.id}>{o.text}</option>)}
          </select>
        </div>
        <div>
          <label className="pnl-label" htmlFor="tkgm-mahalle">Mahalle / köy</label>
          <select id="tkgm-mahalle" className="pnl-input" value={mahalle} disabled={!mahalleler.length}
            onChange={(e) => (setMahalle(Number(e.target.value)), setError(null))}>
            <option value={0}>{loading === "mahalle" ? "Yükleniyor…" : "Mahalle seçin"}</option>
            {mahalleler.map((o) => <option key={o.id} value={o.id}>{o.text}</option>)}
          </select>
        </div>
      </div>
      <div className="grid items-end gap-4 sm:grid-cols-3">
        <div>
          <label className="pnl-label" htmlFor="tkgm-ada">Ada</label>
          <input id="tkgm-ada" className="pnl-input" inputMode="numeric" placeholder="Örn. 230" value={ada} onChange={(e) => setAda(digits(e.target.value))} />
        </div>
        <div>
          <label className="pnl-label" htmlFor="tkgm-parsel">Parsel</label>
          <input id="tkgm-parsel" className="pnl-input" inputMode="numeric" placeholder="Örn. 3" value={parsel} onChange={(e) => setParsel(digits(e.target.value))} />
        </div>
        <button className="pnl-btn-primary" type="submit" disabled={busy || !mahalle || !ada || !parsel}>{busy ? "Sorgulanıyor…" : "Parseli bul"}</button>
      </div>
      {error && <p className="rounded-lg bg-mercan-acik px-3 py-2 text-sm text-mercan-koyu">{error}</p>}
    </form>
  );
}

/** Bulunan parselin uydu görüntüsü üzerinde sınırı; anahtar yoksa hiç gösterilmez. */
export function ParcelMap({ ring }: { ring: { lat: number; lng: number }[] }) {
  const el = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    loadMaps(key)
      .then(async (gm) => {
        const { Map, Polygon } = await gm.importLibrary("maps");
        const { LatLngBounds } = await gm.importLibrary("core");
        if (cancelled || !el.current) return;
        const map = new Map(el.current, {
          mapTypeId: "hybrid",
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: "cooperative",
          clickableIcons: false,
        });
        const bounds = new LatLngBounds();
        ring.forEach((p) => bounds.extend(p));
        map.fitBounds(bounds, 48);
        new Polygon({ map, paths: ring, strokeColor: "#ffc24d", strokeWeight: 3, fillColor: "#ffc24d", fillOpacity: 0.2 });
      })
      .catch(() => setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [key, ring]);

  if (!key || failed) return null;
  return <div ref={el} className="h-72 w-full overflow-hidden rounded-xl border border-ayrac" aria-label="Parselin uydu görüntüsü" />;
}
