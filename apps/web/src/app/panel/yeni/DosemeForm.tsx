"use client";
import { parseListingText, ROOM_LABELS, RoomType, stagingNarration, STYLE_LABELS, StagingStyle } from "@arsa/shared";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ListingFields, listingPayload, type ListingValues } from "./ListingFields";
import { uploadPhoto } from "./photoUpload";
import { VoiceStep } from "./Wizard";

type Photo = { id: string; key?: string; preview: string; room?: RoomType; title: string; error?: string };

const MIN = 2;
const MAX = 6;
const ROOMS = RoomType.options;
const STYLES = StagingStyle.options;

type Details = { kind: string; rooms: string; netM2: string; location: string; highlights: string };
const NO_DETAILS: Details = { kind: "", rooms: "", netM2: "", location: "", highlights: "" };

/** Formdaki ilan bilgisi → sipariş/anlatım alanları (boşlar atlanır). */
function detailsPayload(d: Details) {
  const rooms = d.rooms.replace(/\s/g, "");
  const net = Number(d.netM2.replace(/\D/g, ""));
  return {
    ...(d.kind.trim() && { kind: d.kind.trim() }),
    ...(/^\d{1,2}\+\d{1,2}$/.test(rooms) && { rooms }),
    ...(net >= 10 && { netM2: net }),
    ...(d.location.trim() && { location: d.location.trim() }),
    highlights: d.highlights.split("\n").map((l) => l.trim()).filter((l) => l.length >= 2).slice(0, 5),
  };
}

const STYLE_HINTS: Record<StagingStyle, string> = {
  modern: "Açık gri, meşe, sade çizgiler",
  iskandinav: "Açık ahşap, beyaz tekstil, ferah",
  klasik: "Koyu ahşap, desenli halı, pirinç",
  luks: "Kadife, mermer, altın detaylar",
  dogal: "Hasır, keten, bol bitki",
};

export function DosemeForm() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [style, setStyle] = useState<StagingStyle>("modern");
  const [listing, setListing] = useState<ListingValues>({ price: "", officeName: "", phone: "" });
  const [music, setMusic] = useState(true);
  const [paste, setPaste] = useState("");
  const [details, setDetails] = useState<Details>(NO_DETAILS);
  const [parsed, setParsed] = useState<string | null>(null);
  const [voice, setVoice] = useState(true);
  const [voiceId, setVoiceId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);

  const update = (id: string, patch: Partial<Photo>) => setPhotos((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  const uploading = photos.some((p) => !p.key && !p.error);
  const ready = photos.filter((p) => p.key);
  // Oda tipi önceden atanmaz: yanlış tip (ör. mutfağa "salon") odaya uymayan eşya koydurur.
  const untyped = ready.filter((p) => !p.room).length;

  const priceTry = Number(listing.price.replace(/\D/g, "")) || undefined;
  const narration = stagingNarration(
    ready.flatMap((p) => (p.room ? [p.room] : [])),
    detailsPayload(details),
    priceTry,
  );

  function readListing() {
    const r = parseListingText(paste);
    const d = r.details;
    const found = [d.kind, d.rooms, d.netM2, d.location].filter(Boolean).length + d.highlights.length + (r.priceTry ? 1 : 0);
    if (!found) return setParsed("Metinde ilan bilgisi bulunamadı; alanları elle doldurabilirsiniz.");
    setDetails({
      kind: d.kind ?? details.kind,
      rooms: d.rooms ?? details.rooms,
      netM2: d.netM2 ? String(d.netM2) : details.netM2,
      location: d.location ?? details.location,
      highlights: d.highlights.length ? d.highlights.join("\n") : details.highlights,
    });
    if (r.priceTry && !listing.price) setListing({ ...listing, price: r.priceTry.toLocaleString("tr-TR") });
    setParsed(`${found} bilgi bulundu. Kontrol edip düzeltebilirsiniz.`);
  }

  async function add(files: FileList | File[]) {
    setError(null);
    const list = [...files].filter((f) => f.type.startsWith("image/")).slice(0, MAX - photos.length);
    if (!list.length) return setError(photos.length >= MAX ? `En fazla ${MAX} fotoğraf` : "Fotoğraf dosyası seçin");
    const items: Photo[] = list.map((f, i) => ({
      id: `${Date.now()}-${i}-${f.name}`,
      preview: URL.createObjectURL(f),
      title: "",
    }));
    setPhotos((ps) => [...ps, ...items]);
    await Promise.all(
      list.map(async (f, i) => {
        const id = items[i]!.id;
        try {
          update(id, { key: await uploadPhoto(f) });
        } catch (e) {
          update(id, { error: e instanceof Error ? e.message : "Yüklenemedi" });
        }
      }),
    );
  }

  function move(id: string, dir: -1 | 1) {
    setPhotos((ps) => {
      const i = ps.findIndex((p) => p.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= ps.length) return ps;
      const next = [...ps];
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });
  }

  async function submit() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/videos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        template: "dosenmis-ev",
        photos: ready.map((p) => ({ key: p.key, room: p.room, ...(p.title.trim() ? { title: p.title.trim() } : {}) })),
        style,
        details: detailsPayload(details),
        listing: listingPayload(listing),
        voice,
        ...(voice && voiceId ? { voiceId } : {}),
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
        <h1 className="font-display text-3xl font-bold tracking-[-0.025em]">Boş evi döşe</h1>
        <p className="mt-2 text-mute">
          İlandaki boş odaların fotoğraflarını yükleyin ({MIN}–{MAX} oda). Yapay zekâ her odayı seçtiğiniz tarzda döşer; videoda oda gözünüzün önünde
          eşyalanır. Duvar, pencere ve zemin aynı kalır. Görüntü temsilidir; videoda bu yazılır.
        </p>
      </div>

      <div
        role="button"
        tabIndex={0}
        className={`card grid cursor-pointer place-items-center border-dashed p-8 text-center transition ${drag ? "border-neon bg-neon/5" : "hover:border-neon/50"}`}
        onClick={() => input.current?.click()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && input.current?.click()}
        onDragOver={(e) => (e.preventDefault(), setDrag(true))}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          add(e.dataTransfer.files);
        }}
      >
        <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => e.target.files && (add(e.target.files), (e.target.value = ""))} />
        <div className="font-semibold">Oda fotoğraflarını sürükleyin ya da seçin</div>
        <div className="mt-1 text-sm text-mute">
          {photos.length}/{MAX} fotoğraf · yalnız iç mekân; odayı geniş açıdan gören fotoğraflar en iyi sonucu verir
        </div>
      </div>

      {photos.length > 0 && (
        <ol className="grid gap-3 sm:grid-cols-2">
          {photos.map((p, i) => (
            <li key={p.id} className="card flex gap-3 p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.preview} alt={`Fotoğraf ${i + 1}`} className="h-28 w-20 shrink-0 rounded-lg object-cover" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex items-center justify-between gap-2 text-xs text-mute">
                  <span>
                    {i + 1}. oda · {p.error ? <span className="text-red-300">{p.error}</span> : p.key ? "yüklendi" : "yükleniyor…"}
                  </span>
                  <span className="flex gap-1">
                    <button type="button" className="rounded px-1.5 hover:bg-white/10 disabled:opacity-30" disabled={i === 0} onClick={() => move(p.id, -1)} aria-label="Öne al">↑</button>
                    <button type="button" className="rounded px-1.5 hover:bg-white/10 disabled:opacity-30" disabled={i === photos.length - 1} onClick={() => move(p.id, 1)} aria-label="Geriye al">↓</button>
                    <button type="button" className="rounded px-1.5 hover:bg-white/10" onClick={() => setPhotos((ps) => ps.filter((x) => x.id !== p.id))} aria-label="Kaldır">✕</button>
                  </span>
                </div>
                <select className={`input py-2 ${p.room ? "" : "border-neon/60"}`} value={p.room ?? ""} aria-label={`${i + 1}. oda tipi`} onChange={(e) => update(p.id, { room: e.target.value as RoomType })}>
                  <option value="" disabled>Oda tipini seçin</option>
                  {ROOMS.map((r) => (
                    <option key={r} value={r}>{ROOM_LABELS[r]}</option>
                  ))}
                </select>
                <input className="input py-2" maxLength={40} placeholder={p.room ? `Başlık (boşsa "${ROOM_LABELS[p.room]}")` : "Başlık (isteğe bağlı)"} value={p.title}
                  aria-label={`${i + 1}. oda başlığı`} onChange={(e) => update(p.id, { title: e.target.value })} />
              </div>
            </li>
          ))}
        </ol>
      )}

      <fieldset className="card p-6">
        <legend className="sr-only">Döşeme tarzı</legend>
        <div className="mb-4 font-semibold">Hangi tarzda döşensin?</div>
        <div className="grid gap-3 sm:grid-cols-3">
          {STYLES.map((s) => (
            <label key={s}
              className={`flex cursor-pointer flex-col rounded-xl border p-4 transition ${style === s ? "border-neon bg-neon/10" : "border-line hover:border-neon/50"}`}>
              <input type="radio" name="style" value={s} className="sr-only" checked={style === s} onChange={() => setStyle(s)} />
              <span className="font-semibold">{STYLE_LABELS[s]}</span>
              <span className="mt-1 text-sm text-mute">{STYLE_HINTS[s]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="card space-y-4 p-6">
        <div>
          <div className="font-semibold">İlan bilgileri</div>
          <p className="mt-1 text-sm text-mute">
            Seslendirme bunlardan kurulur. sahibinden.com ilan sayfasında tümünü seçip (Ctrl+A) kopyalayın ve buraya yapıştırın; oda sayısı, metrekare,
            konum ve öne çıkan özellikler ayıklanır.
          </p>
        </div>
        <textarea className="input min-h-24 py-2 text-sm" placeholder="İlan sayfasının metnini yapıştırın" value={paste}
          aria-label="İlan sayfası metni" onChange={(e) => setPaste(e.target.value)} />
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="btn-ghost" disabled={paste.trim().length < 20} onClick={readListing}>Bilgileri ayıkla</button>
          {parsed && <span className="text-sm text-mute">{parsed}</span>}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="kind">Emlak tipi</label>
            <input id="kind" className="input" maxLength={40} placeholder="Örn. Satılık Daire" value={details.kind}
              onChange={(e) => setDetails({ ...details, kind: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="location">Konum</label>
            <input id="location" className="input" maxLength={60} placeholder="Örn. Etimesgut Bağlıca" value={details.location}
              onChange={(e) => setDetails({ ...details, location: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="rooms">Oda sayısı</label>
            <input id="rooms" className="input" maxLength={7} placeholder="Örn. 2+1" value={details.rooms}
              onChange={(e) => setDetails({ ...details, rooms: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="netm2">Net m²</label>
            <input id="netm2" className="input" inputMode="numeric" maxLength={5} placeholder="Örn. 110" value={details.netM2}
              onChange={(e) => setDetails({ ...details, netM2: e.target.value.replace(/\D/g, "") })} />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="highlights">Öne çıkanlar (her satıra bir cümle, en fazla 5)</label>
          <textarea id="highlights" className="input min-h-20 py-2 text-sm" placeholder={"Örn. Metroya beş dakika yürüme mesafesinde.\nSite içinde, havuzlu."}
            value={details.highlights} onChange={(e) => setDetails({ ...details, highlights: e.target.value })} />
        </div>
      </div>

      <div className="card space-y-4 p-6">
        <label className="flex cursor-pointer items-center justify-between">
          <span>
            <span className="block font-semibold">Seslendirme</span>
            <span className="text-sm text-mute">Türkçe anlatım; müzik anlatım sırasında kısılır</span>
          </span>
          <input type="checkbox" className="h-5 w-5 accent-[#ffc24d]" checked={voice} onChange={(e) => setVoice(e.target.checked)} />
        </label>
        {voice && (
          <div className="rounded-lg border border-line p-3 text-sm">
            <div className="mb-1 text-xs text-mute">Anlatım metni{ready.some((p) => !p.room) ? " (oda tipi seçilmeyen fotoğraflar eklenmedi)" : ""}</div>
            <ol className="list-decimal space-y-1 pl-5">
              {[...narration.rooms, narration.outro].map((l, i) => (
                <li key={i}>{l}</li>
              ))}
            </ol>
          </div>
        )}
      </div>
      {voice && <VoiceStep hook={narration.rooms[0] ?? "Bu evi bir de eşyalı hayal edin."} voiceId={voiceId} onSelect={setVoiceId} />}

      <div className="card space-y-4 p-6">
        <p className="text-sm text-mute">Hepsi isteğe bağlı; girdikleriniz videonun sonundaki kartta yazar.</p>
        <ListingFields value={listing} onChange={setListing} />
        <label className="flex cursor-pointer items-center justify-between border-t border-line pt-4">
          <span>
            <span className="block font-semibold">Fon müziği</span>
            <span className="text-sm text-mute">Sinematik, sözsüz müzik</span>
          </span>
          <input type="checkbox" className="h-5 w-5 accent-[#ffc24d]" checked={music} onChange={(e) => setMusic(e.target.checked)} />
        </label>
      </div>

      {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}
      <div className="flex items-center justify-end gap-4">
        {ready.length < MIN ? (
          <span className="text-sm text-mute">En az {MIN} fotoğraf gerekli</span>
        ) : (
          untyped > 0 && <span className="text-sm text-mute">{untyped} fotoğrafın oda tipini seçin</span>
        )}
        <button className="btn-primary" disabled={busy || uploading || ready.length < MIN || untyped > 0} onClick={submit}>
          {busy ? "Gönderiliyor…" : uploading ? "Fotoğraflar yükleniyor…" : "Videoyu oluştur"}
        </button>
      </div>
    </div>
  );
}
