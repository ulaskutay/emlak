"use client";
import { useState } from "react";
import { AgentAvatar, AgentEditor, useAgents } from "@/components/panel/agents";

/** Emlakçı listesi: ekle, düzenle, sil. */
export function AgentsManager() {
  const { agents, setAgents } = useAgents();
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function remove(id: string, name: string) {
    if (!confirm(`${name} silinsin mi? Daha önce hazırlanan videolar etkilenmez.`)) return;
    setError(null);
    const res = await fetch(`/api/agents/${id}`, { method: "DELETE" }).catch(() => null);
    if (!res?.ok) return setError("Silinemedi, yeniden deneyin");
    setAgents((list) => list?.filter((a) => a.id !== id) ?? null);
  }

  if (agents === null) return <div className="pnl-kart h-40 animate-pulse" />;

  return (
    <div className="max-w-3xl space-y-4">
      {error && <p className="rounded-lg bg-mercan-acik px-3 py-2 text-sm text-mercan-koyu">{error}</p>}
      {agents.map((a) =>
        editing === a.id ? (
          <AgentEditor key={a.id} initial={a} onCancel={() => setEditing(null)}
            onSaved={(n) => {
              setAgents((list) => list?.map((x) => (x.id === n.id ? n : x)) ?? null);
              setEditing(null);
            }} />
        ) : (
          <div key={a.id} className="pnl-kart flex flex-wrap items-center gap-4 p-4 sm:p-5">
            <AgentAvatar agent={a} size="h-16 w-16" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-lg font-extrabold">{a.name}</div>
              <div className="truncate text-sm text-gri">{[a.officeName, a.phone].filter(Boolean).join(" · ") || "Ofis ve telefon yok"}</div>
            </div>
            {a.logo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={a.logo.url} alt="Ofis logosu" className="h-12 w-auto max-w-28 rounded-lg border border-ayrac bg-white object-contain p-1" />
            )}
            <div className="flex gap-2">
              <button type="button" className="pnl-btn-ghost" onClick={() => setEditing(a.id)}>Düzenle</button>
              <button type="button" className="pnl-btn-ghost hover:!border-mercan hover:!text-mercan-koyu" onClick={() => remove(a.id, a.name)}>Sil</button>
            </div>
          </div>
        ),
      )}
      {editing === "new" ? (
        <AgentEditor onCancel={() => setEditing(null)}
          onSaved={(n) => {
            setAgents((list) => [...(list ?? []), n]);
            setEditing(null);
          }} />
      ) : (
        <button type="button" onClick={() => setEditing("new")}
          className="flex w-full items-center gap-4 rounded-2xl border border-dashed border-ayrac bg-white p-5 text-left text-gri transition hover:border-gok/60 hover:text-gok">
          <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-zemin text-3xl">+</span>
          <span>
            <span className="block text-lg font-extrabold">{agents.length ? "Başka emlakçı ekle" : "İlk emlakçınızı ekleyin"}</span>
            <span className="block text-sm">Fotoğraf, ad, ofis adı, telefon ve ofis logosu</span>
          </span>
        </button>
      )}
    </div>
  );
}
