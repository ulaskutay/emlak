"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { uploadAgentPhoto, uploadLogo } from "@/app/panel/yeni/photoUpload";

export type Asset = { key: string; url: string };
/** Kayıtlı emlakçı (GET /api/agents). */
export type SavedAgent = { id: string; name: string; officeName: string; phone: string; photo?: Asset; logo?: Asset };
/** Siparişteki kapanış kartı emlakçısı: ad, fotoğraf, logo (ofis adı ve telefon ilan bilgisinde). */
export type CardAgent = { name: string; photo?: Asset; logo?: Asset };
export type AgentContact = { officeName: string; phone: string };

/** Son seçilen emlakçı bir sonraki videoda kendiliğinden seçilir. */
const LAST_KEY = "arsa-video:agent";

/** Siparişe giden emlakçı (boşlar atlanır). */
export const agentPayload = (a: CardAgent) => ({
  ...(a.name.trim() && { name: a.name.trim() }),
  ...(a.photo && { photoKey: a.photo.key }),
  ...(a.logo && { logoKey: a.logo.key }),
});

/** Görsel seçici: önizleme, yükleniyor durumu ve kaldırma düğmesi. */
export function AssetPicker({ label, hint, value, round, upload, onChange }: {
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

/** Yuvarlak emlakçı fotoğrafı; yoksa adın baş harfi. */
export function AgentAvatar({ agent, size = "h-14 w-14" }: { agent: { name: string; photo?: Asset }; size?: string }) {
  return agent.photo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={agent.photo.url} alt={agent.name} className={`${size} shrink-0 rounded-full object-cover ring-2 ring-[#ffc24d]`} />
  ) : (
    <span className={`${size} grid shrink-0 place-items-center rounded-full bg-gok-acik text-lg font-extrabold uppercase text-gok`}>{agent.name.slice(0, 1) || "?"}</span>
  );
}

/** Emlakçı ekleme/düzenleme formu (Emlakçılar sayfası ve şablon formundaki hızlı ekleme). */
export function AgentEditor({ initial, onSaved, onCancel }: { initial?: SavedAgent; onSaved: (a: SavedAgent) => void; onCancel: () => void }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [officeName, setOfficeName] = useState(initial?.officeName ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [photo, setPhoto] = useState(initial?.photo);
  const [logo, setLogo] = useState(initial?.logo);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    const res = await fetch(initial ? `/api/agents/${initial.id}` : "/api/agents", {
      method: initial ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        ...(officeName.trim() && { officeName: officeName.trim() }),
        ...(phone.trim() && { phone: phone.trim() }),
        ...(photo && { photoKey: photo.key }),
        ...(logo && { logoKey: logo.key }),
      }),
    }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    setBusy(false);
    if (!res?.ok) return setError(data?.error ?? "Kaydedilemedi");
    onSaved(data.agent);
  }

  return (
    <div className="space-y-5 rounded-xl border border-gok/40 bg-white p-4 sm:p-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <AssetPicker label="Emlakçı fotoğrafı" hint="Yuvarlak kırpılır" round value={photo} upload={uploadAgentPhoto} onChange={setPhoto} />
        <AssetPicker label="Ofis logosu" hint="Saydam PNG en iyisi" value={logo} upload={uploadLogo} onChange={setLogo} />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="pnl-label" htmlFor="agent-name">Ad soyad</label>
          <input id="agent-name" className="pnl-input" maxLength={60} placeholder="Örn. Ümit G." value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="pnl-label" htmlFor="agent-office">Ofis adı</label>
          <input id="agent-office" className="pnl-input" maxLength={60} placeholder="Örn. Etic Emlak" value={officeName} onChange={(e) => setOfficeName(e.target.value)} />
        </div>
        <div>
          <label className="pnl-label" htmlFor="agent-phone">Telefon</label>
          <input id="agent-phone" className="pnl-input" maxLength={20} inputMode="tel" placeholder="0532 000 00 00" value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/[^0-9+ ()-]/g, ""))} />
        </div>
      </div>
      {error && <p className="rounded-lg bg-mercan-acik px-3 py-2 text-sm text-mercan-koyu">{error}</p>}
      <div className="flex justify-end gap-3">
        <button type="button" className="pnl-btn-ghost" onClick={onCancel}>Vazgeç</button>
        <button type="button" className="pnl-btn-primary" disabled={busy || name.trim().length < 2} onClick={save}>
          {busy ? "Kaydediliyor…" : initial ? "Kaydet" : "Emlakçıyı ekle"}
        </button>
      </div>
    </div>
  );
}

/** Kayıtlı emlakçılar; sayfa yeniden görünür olunca (başka sekmede eklenmiş olabilir) tazelenir. */
export function useAgents() {
  const [agents, setAgents] = useState<SavedAgent[] | null>(null);
  const load = useCallback(async () => {
    const res = await fetch("/api/agents").catch(() => null);
    const data = res?.ok ? await res.json().catch(() => null) : null;
    if (data) setAgents(data.agents);
  }, []);
  useEffect(() => {
    load();
    const onVisible = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [load]);
  return { agents, setAgents };
}

const toCard = (a: SavedAgent): CardAgent => ({ name: a.name, photo: a.photo, logo: a.logo });

/**
 * Şablon formunda kapanış kartının emlakçısı: kayıtlı emlakçılardan biri, ilandan aktarılan emlakçı ya da emlakçısız.
 * Kayıtlı emlakçı seçilince ofis adı ve telefonu da gelir (formdaki alanlardan değiştirilebilir).
 */
export function AgentSelect({ onChange, imported }: {
  onChange: (agent: CardAgent, contact?: AgentContact) => void;
  /** İlandan aktarılan emlakçı (ilan videosu formları); gelince o seçilir. */
  imported?: CardAgent | null;
}) {
  const { agents, setAgents } = useAgents();
  const [selected, setSelected] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const pick = useCallback(
    (id: string, list: SavedAgent[] = agents ?? []) => {
      setSelected(id);
      if (id === "ilan" && imported) return onChange(imported);
      const a = list.find((x) => x.id === id);
      try {
        localStorage.setItem(LAST_KEY, a ? a.id : "none");
      } catch {}
      if (!a) return onChange({ name: "" });
      onChange(toCard(a), { officeName: a.officeName, phone: a.phone });
    },
    [agents, imported, onChange],
  );

  // İlk yüklemede son seçilen (yoksa ilk) emlakçı seçilir; sonraki tazelemeler seçimi değiştirmez.
  useEffect(() => {
    if (!agents || selected) return;
    let last: string | null = null;
    try {
      last = localStorage.getItem(LAST_KEY);
    } catch {}
    const first = last === "none" ? undefined : (agents.find((a) => a.id === last) ?? agents[0]);
    if (first) pick(first.id, agents);
    else setSelected("none");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agents]);

  // İlan aktarılınca ilandaki emlakçı seçilir.
  useEffect(() => {
    if (imported) {
      setSelected("ilan");
      onChange(imported);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imported]);

  const option = (id: string, body: React.ReactNode) => (
    <button key={id} type="button" aria-pressed={selected === id} onClick={() => pick(id)}
      className={`flex min-w-0 items-center gap-3 rounded-xl border p-3 text-left transition ${selected === id ? "border-gok bg-gok-acik" : "border-ayrac bg-white hover:border-gok/50"}`}>
      {body}
    </button>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="pnl-label !mb-0">Emlakçı</div>
        <Link href="/panel/emlakcilar" target="_blank" className="text-sm font-semibold text-gok hover:underline">Emlakçıları yönet</Link>
      </div>
      {agents === null ? (
        <div className="h-20 animate-pulse rounded-xl bg-zemin" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {agents.map((a) =>
            option(
              a.id,
              <>
                <AgentAvatar agent={a} />
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{a.name}</span>
                  <span className="block truncate text-sm text-gri">{[a.officeName, a.phone].filter(Boolean).join(" · ") || "Ofis ve telefon yok"}</span>
                </span>
              </>,
            ),
          )}
          {imported &&
            option(
              "ilan",
              <>
                <AgentAvatar agent={imported} />
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{imported.name || "İlandaki emlakçı"}</span>
                  <span className="block truncate text-sm text-gri">İlandan aktarıldı</span>
                </span>
              </>,
            )}
          {option(
            "none",
            <>
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full border border-dashed border-ayrac text-gri">—</span>
              <span className="min-w-0">
                <span className="block font-semibold">Emlakçısız</span>
                <span className="block text-sm text-gri">Kartta fiyat, ofis ve telefon</span>
              </span>
            </>,
          )}
          {!adding && (
            <button type="button" onClick={() => setAdding(true)}
              className="flex items-center gap-3 rounded-xl border border-dashed border-ayrac p-3 text-left text-gri transition hover:border-gok/60 hover:text-gok">
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-zemin text-2xl">+</span>
              <span>
                <span className="block font-semibold">Yeni emlakçı ekle</span>
                <span className="block text-sm">Fotoğraf, logo ve telefonla kaydedin</span>
              </span>
            </button>
          )}
        </div>
      )}
      {adding && (
        <AgentEditor
          onCancel={() => setAdding(false)}
          onSaved={(a) => {
            const list = [...(agents ?? []), a];
            setAgents(list);
            setAdding(false);
            pick(a.id, list);
          }}
        />
      )}
    </div>
  );
}
