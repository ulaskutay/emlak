"use client";
import { useEffect, useMemo, useRef, useState } from "react";

/** Videoda anlatılacak çevre noktası (@arsa/shared ReelPoi ile aynı biçim). */
export type PoiItem = {
  category: string;
  label: string;
  emoji: string;
  name?: string;
  position: { lat: number; lng: number };
  distanceM: number;
  source?: "google" | "dem" | "user";
};
type Category = { id: string; label: string; emoji: string };

export const MAX_POIS = 4;
const poiKey = (p: PoiItem) => `${p.category}|${p.name ?? ""}|${p.position.lat.toFixed(5)},${p.position.lng.toFixed(5)}`;
const SOURCE: Record<string, string> = { google: "Google", dem: "Uydu yükseklik verisi", user: "Sizin eklediğiniz" };

function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const r = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}
export const formatDistance = (m: number) =>
  m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} km`;

/** Google Maps JavaScript API'yi bir kez yükler. */
let mapsPromise: Promise<any> | null = null;
function loadMaps(key: string): Promise<any> {
  const w = window as any;
  if (w.google?.maps?.importLibrary) return Promise.resolve(w.google.maps);
  mapsPromise ??= new Promise((resolve, reject) => {
    w.__arsaMapsReady = () => resolve(w.google.maps);
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly&loading=async&language=tr&region=TR&callback=__arsaMapsReady`;
    s.async = true;
    s.onerror = () => reject(new Error("Google Haritalar yüklenemedi"));
    document.head.appendChild(s);
  });
  return mapsPromise;
}

export function PoiStep({
  center,
  ring,
  district,
  province,
  neighbourhood,
  selected,
  onChange,
  onBack,
  onNext,
}: {
  center: { lat: number; lng: number };
  ring: { lat: number; lng: number }[];
  district?: string;
  province?: string;
  neighbourhood?: string;
  selected: PoiItem[] | null;
  onChange: (pois: PoiItem[]) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const [candidates, setCandidates] = useState<PoiItem[] | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [draft, setDraft] = useState<{ position: { lat: number; lng: number }; category: string; name: string } | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const mapEl = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const markers = useRef<any[]>([]);
  const [suggestedKeys, setSuggestedKeys] = useState<Set<string>>(new Set());
  const chosen = selected ?? [];
  const chosenKeys = useMemo(() => new Set(chosen.map(poiKey)), [chosen]);

  // Adaylar + her kategoriden en iyisi ("önerilen" rozeti). Hiçbiri kendiliğinden seçilmez: videoya yalnızca
  // kullanıcının seçtikleri girer.
  useEffect(() => {
    fetch("/api/parcel/pois", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...center, district, province, neighbourhood }) })
      .then((r) => r.json())
      .then((d: { pois?: PoiItem[]; suggested?: PoiItem[]; categories?: Category[]; warnings?: string[]; error?: string }) => {
        setCandidates(d.pois ?? []);
        setCategories(d.categories ?? []);
        setWarnings(d.error ? [d.error] : (d.warnings ?? []));
        setSuggestedKeys(new Set((d.suggested ?? []).map(poiKey)));
      })
      .catch(() => (setCandidates([]), setWarnings(["Çevre noktaları alınamadı; haritaya tıklayarak kendiniz ekleyebilirsiniz."])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Harita: uydu + yer adları, parsel sınırı; tıklanan yere yeni nokta eklenir.
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!key) return setMapError("Harita anahtarı tanımlı değil (GOOGLE_MAPS_API_KEY)");
    let cancelled = false;
    loadMaps(key)
      .then(async (gm) => {
        const { Map, Polygon } = await gm.importLibrary("maps");
        if (cancelled || !mapEl.current) return;
        map.current = new Map(mapEl.current, {
          center,
          zoom: 13,
          mapTypeId: "hybrid",
          mapId: "DEMO_MAP_ID",
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: "cooperative", // tekerlek sayfayı kaydırır; yakınlaştırma Ctrl+tekerlek ya da +/-
          clickableIcons: false,
        });
        new Polygon({ map: map.current, paths: ring, strokeColor: "#00e5ff", strokeWeight: 3, fillColor: "#00e5ff", fillOpacity: 0.25 });
        map.current.addListener("click", (e: any) =>
          setDraft({ position: { lat: e.latLng.lat(), lng: e.latLng.lng() }, category: "custom", name: "" }),
        );
        setMapReady((n) => n + 1);
      })
      .catch((e) => setMapError(String(e.message ?? e)));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [mapReady, setMapReady] = useState(0);

  // İşaretler: seçililer sarı, öneriler soluk; tıklayınca seçilir/bırakılır. Seçim değişince yeniden çizilir.
  useEffect(() => {
    const gm = (window as any).google?.maps;
    if (!map.current || !gm || !candidates) return;
    let cancelled = false;
    (async () => {
      const { AdvancedMarkerElement } = await gm.importLibrary("marker");
      if (cancelled) return;
      markers.current.forEach((m) => (m.map = null));
      const all = [...chosen, ...candidates.filter((c) => !chosenKeys.has(poiKey(c)))];
      markers.current = all.map((p) => {
        const on = chosenKeys.has(poiKey(p));
        const el = document.createElement("div");
        el.textContent = `${p.emoji} ${p.name ?? p.label}`;
        el.style.cssText = `padding:4px 9px;border-radius:999px;font:600 12px system-ui;white-space:nowrap;cursor:pointer;
          background:${on ? "#ffc83d" : "rgba(13,18,25,.85)"};color:${on ? "#070a0f" : "#fff"};border:2px solid ${on ? "#fff" : "rgba(255,255,255,.35)"}`;
        const m = new AdvancedMarkerElement({ map: map.current, position: p.position, content: el, zIndex: on ? 2 : 1, title: `${p.label} · ${formatDistance(p.distanceM)}` });
        m.addListener("click", () => toggle(p));
        return m;
      });
      // İlk çizimde parsel + seçililer kadraja alınır.
      if (markers.current.length && !fitted.current) {
        fitted.current = true;
        const b = new gm.LatLngBounds();
        ring.forEach((q) => b.extend(q));
        // Uzak noktalar (havalimanı vb.) kadrajı büyütüp yakındakileri üst üste bindirmesin: 20 km içi.
        (chosen.length ? chosen : candidates.slice(0, 6)).filter((p) => p.distanceM <= 20_000).forEach((p) => b.extend(p.position));
        map.current.fitBounds(b, 40);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidates, chosenKeys, mapReady]);
  const fitted = useRef(false);

  function toggle(p: PoiItem) {
    const k = poiKey(p);
    if (chosenKeys.has(k)) return onChange(chosen.filter((c) => poiKey(c) !== k));
    if (chosen.length >= MAX_POIS) return;
    onChange([...chosen, p].sort((a, b) => a.distanceM - b.distanceM));
  }

  function addDraft() {
    if (!draft) return;
    const cat = categories.find((c) => c.id === draft.category) ?? { id: "custom", label: "Önemli Nokta", emoji: "📍" };
    const name = draft.name.trim();
    if (draft.category === "custom" && !name) return;
    const p: PoiItem = {
      category: cat.id,
      label: cat.label,
      emoji: cat.emoji,
      ...(name ? { name } : {}),
      position: draft.position,
      distanceM: distanceM(center, draft.position),
      source: "user",
    };
    setCandidates((c) => [p, ...(c ?? [])]);
    if (chosen.length < MAX_POIS) onChange([...chosen, p].sort((a, b) => a.distanceM - b.distanceM));
    setDraft(null);
  }

  // Öneriler: önce her kategorinin en iyisi, sonra kategori başına en yakın 3 (seçililer hariç).
  const top = useMemo(() => (candidates ?? []).filter((c) => suggestedKeys.has(poiKey(c)) && !chosenKeys.has(poiKey(c))), [candidates, suggestedKeys, chosenKeys]);
  const grouped = useMemo(() => {
    const g = new globalThis.Map<string, PoiItem[]>();
    for (const c of candidates ?? []) {
      if (chosenKeys.has(poiKey(c)) || suggestedKeys.has(poiKey(c))) continue;
      const list = g.get(c.label) ?? [];
      if (list.length < 3) g.set(c.label, [...list, c]);
    }
    return [...g.entries()];
  }, [candidates, chosenKeys, suggestedKeys]);
  const full = chosen.length >= MAX_POIS;
  const row = (p: PoiItem) => (
    <li key={poiKey(p)}>
      <button disabled={full} onClick={() => toggle(p)}
        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-white/5 disabled:opacity-40">
        <span className="grid h-5 w-5 shrink-0 place-items-center rounded border border-line text-xs text-neon">+</span>
        <span>{p.emoji}</span>
        <span className="min-w-0 flex-1 truncate">{p.name ?? p.label}</span>
        <span className="text-mute">{formatDistance(p.distanceM)}</span>
      </button>
    </li>
  );

  return (
    <div className="space-y-4">
      <div className="card overflow-hidden p-0">
        <div ref={mapEl} className="h-[380px] w-full bg-panel" />
        {mapError && <p className="px-4 py-3 text-sm text-red-300">{mapError}</p>}
        <p className="border-t border-line px-4 py-2.5 text-xs text-mute">
          Önerilere tıklayarak seçin; listede olmayan bir yer için haritada o noktaya tıklayın.
        </p>
      </div>

      {draft && (
        <div className="card space-y-3 border-neon/50 p-4">
          <div className="text-sm font-semibold">
            Yeni nokta · parsele {formatDistance(distanceM(center, draft.position))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <select className="input" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })}>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.emoji} {c.label}
                </option>
              ))}
            </select>
            <input className="input" maxLength={60} autoFocus placeholder={draft.category === "custom" ? "Adı (zorunlu), ör. Termal Otel" : "Adı (isteğe bağlı)"}
              value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} onKeyDown={(e) => e.key === "Enter" && addDraft()} />
          </div>
          <div className="flex justify-end gap-2">
            <button className="btn-ghost" onClick={() => setDraft(null)}>Vazgeç</button>
            <button className="btn-primary" disabled={draft.category === "custom" && !draft.name.trim()} onClick={addDraft}>Ekle</button>
          </div>
        </div>
      )}

      <div className="card p-5">
        <div className="mb-3 flex items-baseline justify-between">
          <div className="font-semibold">Videoda anlatılacak noktalar</div>
          <div className="text-xs text-mute">{chosen.length}/{MAX_POIS} · yakından uzağa sırayla</div>
        </div>
        {!candidates && <div className="text-sm text-mute">Çevre taranıyor (Google yerler, denize uzaklık)…</div>}
        {candidates && !chosen.length && (
          <div className="text-sm text-mute">
            Aşağıdaki önerilerden ya da haritadan seçin (en fazla {MAX_POIS}). Seçmezseniz video yalnızca parseli anlatır.
          </div>
        )}
        <ul className="space-y-2">
          {chosen.map((p) => (
            <li key={poiKey(p)} className="flex items-center gap-3 rounded-xl border border-amber/60 bg-amber/10 px-3 py-2">
              <span className="text-xl">{p.emoji}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{p.name ?? p.label}</span>
                <span className="text-xs text-mute">{p.label} · {SOURCE[p.source ?? ""] ?? ""}</span>
              </span>
              <span className="font-bold text-amber">{formatDistance(p.distanceM)}</span>
              <button className="text-mute hover:text-white" aria-label="Çıkar" onClick={() => toggle(p)}>✕</button>
            </li>
          ))}
        </ul>
      </div>

      {!!top.length && (
        <div className="card p-5">
          <div className="mb-1 font-semibold">Önerilen noktalar</div>
          <p className="mb-3 text-xs text-mute">Her kategoriden parsele en uygun olan; videoya eklemek için tıklayın.</p>
          <ul className="grid gap-x-6 gap-y-1 sm:grid-cols-2">{top.map((p) => (
            <li key={poiKey(p)}>
              <button disabled={full} onClick={() => toggle(p)}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-white/5 disabled:opacity-40">
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded border border-line text-xs text-neon">+</span>
                <span>{p.emoji}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{p.name ?? p.label}</span>
                  <span className="text-xs text-mute">{p.label}</span>
                </span>
                <span className="text-mute">{formatDistance(p.distanceM)}</span>
              </button>
            </li>
          ))}</ul>
        </div>
      )}

      {!!grouped.length && (
        <div className="card p-5">
          <div className="mb-3 font-semibold">Diğer yakın yerler</div>
          <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
            {grouped.map(([label, list]) => (
              <div key={label}>
                <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-mute">{label}</div>
                <ul className="space-y-1">{list.map(row)}</ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {!!warnings.length && (
        <ul className="space-y-1 rounded-lg bg-amber/10 px-3 py-2 text-xs text-amber">
          {warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}

      <div className="flex justify-between">
        <button className="btn-ghost" onClick={onBack}>← Geri</button>
        <button className="btn-primary" onClick={onNext}>Devam →</button>
      </div>
    </div>
  );
}
