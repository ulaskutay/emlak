"use client";
import { REEL_STAGES, type ReelListing, type ReelStage, type ReelStatus } from "@arsa/shared";
import { useCallback, useEffect, useState } from "react";
import { overallProgress, statusLabel, statusTone } from "@/components/status";
import { formatArea, formatDate, parcelPlace, parcelTitle } from "@/lib/format";

type Video = {
  id: string;
  status: ReelStatus;
  stage: ReelStage | null;
  progress: number;
  parcelSummary: { areaM2: number; ada?: string; parsel?: string; nitelik?: string; il?: string; ilce?: string; mahalle?: string };
  listing: ReelListing;
  durationSec: number | null;
  error: string | null;
  createdAt: string;
  finishedAt: string | null;
};

export function VideoStatus({ id }: { id: string }) {
  const [data, setData] = useState<{ video: Video; urls: { play?: string; download?: string; poster?: string } } | null>(null);
  const [retrying, setRetrying] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/videos/${id}`, { cache: "no-store" });
    if (res.ok) setData(await res.json());
  }, [id]);

  useEffect(() => {
    load();
    const t = setInterval(() => {
      // Bitmiş ya da hatalı videoda sorgu durur.
      setData((d) => {
        if (!d || d.video.status === "queued" || d.video.status === "running") load();
        return d;
      });
    }, 3000);
    return () => clearInterval(t);
  }, [load]);

  if (!data) return <div className="text-mute">Yükleniyor…</div>;
  const v = data.video;
  const pct = Math.round(overallProgress(v.status, v.stage, v.progress) * 100);
  const stageIndex = v.status === "done" ? REEL_STAGES.length : REEL_STAGES.findIndex((s) => s.id === v.stage);

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,380px)_1fr]">
      <div className="card overflow-hidden">
        <div className="relative aspect-[9/16] bg-gradient-to-b from-[#0e1a24] to-ink">
          {v.status === "done" && data.urls.play ? (
            <video src={data.urls.play} poster={data.urls.poster} controls playsInline className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full place-items-center p-8 text-center">
              {v.status === "failed" ? (
                <div className="text-red-300">Video üretilemedi</div>
              ) : (
                <div>
                  <div className="mx-auto h-14 w-14 animate-spin rounded-full border-4 border-neon/20 border-t-neon" />
                  <div className="mt-5 text-4xl font-black text-neon">%{pct}</div>
                  <div className="mt-1 text-sm text-mute">{statusLabel(v.status, v.stage)}</div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-6">
        <div>
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusTone[v.status]}`}>{statusLabel(v.status, v.stage)}</span>
          <h1 className="mt-3 text-2xl font-extrabold">{parcelTitle(v.parcelSummary)}</h1>
          <div className="text-mute">{parcelPlace(v.parcelSummary)} · {formatArea(v.parcelSummary.areaM2)}</div>
          <div className="mt-1 text-xs text-mute">
            {formatDate(v.createdAt)}
            {v.durationSec ? ` · ${v.durationSec.toFixed(0)} sn video` : ""}
          </div>
        </div>

        {v.status === "done" && data.urls.download && (
          <a href={data.urls.download} className="btn-primary">⬇ Videoyu indir (1080×1920)</a>
        )}

        {v.status === "failed" && (
          <div className="card space-y-3 border-red-500/30 p-4">
            <div className="text-sm text-red-300">{v.error ?? "Bilinmeyen hata"}</div>
            <button className="btn-ghost" disabled={retrying}
              onClick={async () => {
                setRetrying(true);
                await fetch(`/api/videos/${id}/retry`, { method: "POST" });
                setRetrying(false);
                load();
              }}>
              {retrying ? "…" : "Tekrar dene"}
            </button>
          </div>
        )}

        <ol className="card divide-y divide-line">
          {REEL_STAGES.map((s, i) => {
            const done = i < stageIndex || v.status === "done";
            const active = i === stageIndex && v.status === "running";
            return (
              <li key={s.id} className="flex items-center gap-3 px-4 py-3">
                <span className={`grid h-7 w-7 place-items-center rounded-full text-xs font-bold ${done ? "bg-neon text-ink" : active ? "border-2 border-neon text-neon" : "border border-line text-mute"}`}>
                  {done ? "✓" : i + 1}
                </span>
                <span className={done || active ? "text-white" : "text-mute"}>{s.label}</span>
                {active && s.id === "render" && <span className="ml-auto text-sm text-neon">%{Math.round(v.progress * 100)}</span>}
                {active && s.id !== "render" && <span className="ml-auto h-2 w-2 animate-pulse rounded-full bg-neon" />}
              </li>
            );
          })}
        </ol>

        {(v.listing.priceTry || v.listing.officeName || v.listing.phone || v.listing.zoning) && (
          <dl className="card grid grid-cols-2 gap-3 p-4 text-sm">
            {v.listing.priceTry && (<div><dt className="text-mute">Fiyat</dt><dd className="font-semibold">{v.listing.priceTry.toLocaleString("tr-TR")} ₺</dd></div>)}
            {v.listing.zoning && (<div><dt className="text-mute">İmar</dt><dd className="font-semibold">{v.listing.zoning}</dd></div>)}
            {v.listing.officeName && (<div><dt className="text-mute">Ofis</dt><dd className="font-semibold">{v.listing.officeName}</dd></div>)}
            {v.listing.phone && (<div><dt className="text-mute">Telefon</dt><dd className="font-semibold">{v.listing.phone}</dd></div>)}
          </dl>
        )}
      </div>
    </div>
  );
}
