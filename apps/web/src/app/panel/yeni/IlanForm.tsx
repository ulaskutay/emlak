"use client";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ListingFields, listingPayload, type ListingValues } from "./ListingFields";
import { uploadPhoto } from "./photoUpload";

type Photo = { id: string; key?: string; preview: string; setting: "exterior" | "interior"; title: string; error?: string };

const MIN = 3;
const MAX = 8;

export function IlanForm() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [listing, setListing] = useState<ListingValues>({ price: "", officeName: "", phone: "" });
  const [music, setMusic] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);

  const update = (id: string, patch: Partial<Photo>) => setPhotos((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  const uploading = photos.some((p) => !p.key && !p.error);
  const ready = photos.filter((p) => p.key);

  async function add(files: FileList | File[]) {
    setError(null);
    const list = [...files].filter((f) => f.type.startsWith("image/")).slice(0, MAX - photos.length);
    if (!list.length) return setError(photos.length >= MAX ? `En fazla ${MAX} fotoğraf` : "Fotoğraf dosyası seçin");
    const items: Photo[] = list.map((f, i) => ({
      id: `${Date.now()}-${i}-${f.name}`,
      preview: URL.createObjectURL(f),
      // İlk fotoğraf genelde dış cephe; gerisi iç mekân varsayılır, kullanıcı değiştirir.
      setting: photos.length + i === 0 ? "exterior" : "interior",
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
        template: "ilan-videosu",
        photos: ready.map((p) => ({ key: p.key, setting: p.setting, ...(p.title.trim() ? { title: p.title.trim() } : {}) })),
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
        <h1 className="font-display text-3xl font-bold tracking-[-0.025em]">Fotoğraftan ilan videosu</h1>
        <p className="mt-2 text-mute">
          {MIN}–{MAX} fotoğraf seçin. Sıralama videodaki sırayı belirler; her fotoğraf yaklaşık 3,5 saniyelik bir sahne olur.
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
        <div className="font-semibold">Fotoğrafları sürükleyin ya da seçin</div>
        <div className="mt-1 text-sm text-mute">
          {photos.length}/{MAX} fotoğraf · yatay fotoğraflar dikey videoya ortadan kırpılır
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
                    {i + 1}. sahne · {p.error ? <span className="text-red-300">{p.error}</span> : p.key ? "yüklendi" : "yükleniyor…"}
                  </span>
                  <span className="flex gap-1">
                    <button type="button" className="rounded px-1.5 hover:bg-white/10 disabled:opacity-30" disabled={i === 0} onClick={() => move(p.id, -1)} aria-label="Öne al">↑</button>
                    <button type="button" className="rounded px-1.5 hover:bg-white/10 disabled:opacity-30" disabled={i === photos.length - 1} onClick={() => move(p.id, 1)} aria-label="Geriye al">↓</button>
                    <button type="button" className="rounded px-1.5 hover:bg-white/10" onClick={() => setPhotos((ps) => ps.filter((x) => x.id !== p.id))} aria-label="Kaldır">✕</button>
                  </span>
                </div>
                <div className="flex rounded-lg border border-line p-0.5 text-xs" role="radiogroup" aria-label="Mekân">
                  {(["exterior", "interior"] as const).map((s) => (
                    <button key={s} type="button" role="radio" aria-checked={p.setting === s}
                      className={`flex-1 rounded-md px-2 py-1.5 font-semibold ${p.setting === s ? "bg-neon text-ink" : "text-mute hover:text-white"}`}
                      onClick={() => update(p.id, { setting: s })}>
                      {s === "exterior" ? "Dış mekân" : "İç mekân"}
                    </button>
                  ))}
                </div>
                <input className="input py-2" maxLength={40} placeholder="Başlık (isteğe bağlı)" value={p.title}
                  aria-label={`${i + 1}. sahne başlığı`} onChange={(e) => update(p.id, { title: e.target.value })} />
              </div>
            </li>
          ))}
        </ol>
      )}

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
        {ready.length < MIN && <span className="text-sm text-mute">En az {MIN} fotoğraf gerekli</span>}
        <button className="btn-primary" disabled={busy || uploading || ready.length < MIN} onClick={submit}>
          {busy ? "Gönderiliyor…" : uploading ? "Fotoğraflar yükleniyor…" : "Videoyu oluştur"}
        </button>
      </div>
    </div>
  );
}
