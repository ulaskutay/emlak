"use client";
import { TEMPLATES, type ReelListing, type ReelStatus, type TemplateId } from "@arsa/shared";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ProgressBar, StatusBadge } from "@/components/panel/ui";
import { overallProgress, statusLabel, videoTitle } from "@/components/status";
import { formatArea, formatDate, parcelPlace } from "@/lib/format";
import { ApproachRecorder } from "./ApproachRecorder";

type Video = {
  id: string;
  template: TemplateId;
  input: unknown;
  status: ReelStatus;
  stage: string | null;
  progress: number;
  parcelSummary: { areaM2: number; ada?: string; parsel?: string; nitelik?: string; il?: string; ilce?: string; mahalle?: string } | null;
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

  if (!data)
    return (
      <div className="animate-pulse space-y-4" aria-label="Yükleniyor">
        <div className="h-4 w-24 rounded bg-ayrac" />
        <div className="h-8 w-72 max-w-full rounded-lg bg-ayrac" />
        <div className="h-40 rounded-2xl bg-white" />
      </div>
    );
  const v = data.video;
  const stages = (TEMPLATES[v.template] ?? TEMPLATES["arsa-drone"]).stages;
  const progress = overallProgress(v.status, v.stage, v.progress, v.template);
  const pct = Math.round(progress * 100);
  const stageIndex = v.status === "done" ? stages.length : stages.findIndex((s) => s.id === v.stage);
  const working = v.status === "queued" || v.status === "running";
  const ready = v.status === "done" && data.urls.play;
  // İnşaat videosu: drone yaklaşma çekimi bu sayfada, üretim sürerken çizilir (çekim videoya bağlanana dek; hata
  // kartta gösterilir, "Yeniden dene" ile tekrarlanır).
  const recordApproach = v.template === "insaat-videosu" && working && !(v.input as { approachKey?: string } | null)?.approachKey;

  return (
    <div>
      <Link href="/panel/videolar" className="-ml-1 mb-2 inline-flex min-h-9 items-center gap-1 rounded-lg px-1 text-sm font-semibold text-gri hover:text-gok">
        <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden><path d="M12 5l-5 5 5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        Videolarım
      </Link>
      <div className="mb-6 sm:mb-8">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={v.status} stage={v.stage} template={v.template} />
          <span className="text-sm font-semibold text-gri">{TEMPLATES[v.template]?.name}</span>
        </div>
        <h1 className="mt-2 text-[1.625rem] font-extrabold leading-tight tracking-[-0.03em] sm:text-[2rem]">{videoTitle(v)}</h1>
        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-sm text-gri">
          {v.parcelSummary && <span>{parcelPlace(v.parcelSummary)} · {formatArea(v.parcelSummary.areaM2)}</span>}
          <span>{formatDate(v.createdAt)}{v.durationSec ? ` · ${v.durationSec.toFixed(0)} sn` : ""}</span>
        </div>
        {/* Telefonda indirme düğmesi uzun videonun altında kalmasın. */}
        {v.status === "done" && data.urls.download && (
          <a href={data.urls.download} className="pnl-btn-primary mt-4 w-full lg:hidden">
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M10 3v10M5.5 8.5 10 13l4.5-4.5M4 16.5h12" /></svg>
            Videoyu indirin · 1080×1920
          </a>
        )}
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)] lg:gap-10">
        <div className={`pnl-kart mx-auto w-full max-w-[360px] overflow-hidden p-2 ${ready ? "" : "hidden lg:block"}`}>
          <div className={`relative aspect-[9/16] overflow-hidden rounded-xl ${v.status === "failed" ? "bg-mercan-acik/60" : "bg-gradient-to-b from-gok-acik to-[#dbe6ff]"}`}>
            {ready ? (
              <video src={data.urls.play} poster={data.urls.poster} controls playsInline className="h-full w-full bg-lacivert object-cover" />
            ) : (
              <>
                {data.urls.poster && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={data.urls.poster} alt="" className="absolute inset-0 h-full w-full object-cover opacity-35 blur-[2px]" />
                )}
                <div className="relative grid h-full place-items-center p-8 text-center">
                  {v.status === "failed" ? (
                    <div className="font-bold text-mercan-koyu">Video üretilemedi</div>
                  ) : (
                    <div>
                      <div className="mx-auto h-14 w-14 animate-spin rounded-full border-4 border-gok/20 border-t-gok" />
                      <div className="mt-5 text-4xl font-extrabold tabular-nums text-gok">%{pct}</div>
                      <div className="mt-1 text-sm font-semibold text-lacivert">{statusLabel(v.status, v.stage, v.template)}</div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="min-w-0 space-y-5">
          {working && (
            <div className="pnl-kart p-5 sm:p-6">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-gri">{v.status === "queued" ? "Sırada bekliyor" : "Video hazırlanıyor"}</div>
                  <div className="mt-0.5 text-lg font-extrabold">{statusLabel(v.status, v.stage, v.template)}</div>
                </div>
                <div className="text-[2rem] font-extrabold leading-none tabular-nums text-gok">%{pct}</div>
              </div>
              <ProgressBar value={progress} className="mt-4" />
              <p className="mt-3 text-sm text-gri">Bu sayfa kendiliğinden güncellenir; kapatabilirsiniz, video Videolarım&apos;da sizi bekler.</p>
            </div>
          )}

          {recordApproach && <ApproachRecorder videoId={v.id} />}

          {v.status === "done" && data.urls.download && (
            <div className="pnl-kart hidden items-center justify-between gap-4 p-6 lg:flex">
              <div>
                <div className="text-lg font-extrabold">Videonuz hazır</div>
                <div className="text-sm text-gri">Dikey 1080×1920 MP4 · Reels, TikTok ve Shorts için</div>
              </div>
              <a href={data.urls.download} className="pnl-btn-primary shrink-0">
                <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M10 3v10M5.5 8.5 10 13l4.5-4.5M4 16.5h12" /></svg>
                Videoyu indirin
              </a>
            </div>
          )}

          {v.status === "failed" && (
            <div className="pnl-kart space-y-4 border-mercan/40 bg-mercan-acik/40 p-5 sm:p-6">
              <div>
                <div className="text-lg font-extrabold text-mercan-koyu">Video üretilemedi</div>
                <div className="mt-1 text-sm text-lacivert">{v.error ?? "Bilinmeyen hata"}</div>
              </div>
              <button className="pnl-btn-ghost w-full sm:w-auto" disabled={retrying}
                onClick={async () => {
                  setRetrying(true);
                  await fetch(`/api/videos/${id}/retry`, { method: "POST" });
                  setRetrying(false);
                  load();
                }}>
                {retrying ? "Yeniden başlatılıyor…" : "Tekrar dene"}
              </button>
            </div>
          )}

          <section className="pnl-kart">
            <h2 className="border-b border-ayrac px-5 py-3.5 text-sm font-extrabold">Aşamalar</h2>
            <ol className="divide-y divide-ayrac">
              {stages.map((s, i) => {
                const done = i < stageIndex || v.status === "done";
                const active = i === stageIndex && v.status === "running";
                const failed = i === stageIndex && v.status === "failed";
                return (
                  <li key={s.id} className={`flex items-center gap-3 px-5 py-3 ${active ? "bg-gok-acik/40" : ""}`}>
                    <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${
                      done ? "bg-cimen text-white" : failed ? "bg-mercan text-white" : active ? "border-2 border-gok text-gok" : "border border-ayrac text-gri"
                    }`}>
                      {done ? "✓" : failed ? "!" : i + 1}
                    </span>
                    <span className={`min-w-0 flex-1 ${done || active ? "font-semibold text-lacivert" : failed ? "font-semibold text-mercan-koyu" : "text-gri"}`}>{s.label}</span>
                    {active && v.progress > 0 && <span className="text-sm font-bold tabular-nums text-gok">%{Math.round(v.progress * 100)}</span>}
                    {active && !(v.progress > 0) && <span className="h-2 w-2 animate-pulse rounded-full bg-gok" />}
                  </li>
                );
              })}
            </ol>
          </section>

          {(v.listing.priceTry || v.listing.officeName || v.listing.phone || v.listing.zoning) && (
            <section className="pnl-kart">
              <h2 className="border-b border-ayrac px-5 py-3.5 text-sm font-extrabold">İlan bilgileri</h2>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-4 p-5 text-sm">
                {v.listing.priceTry && (<div><dt className="text-gri">Fiyat</dt><dd className="mt-0.5 font-bold">{v.listing.priceTry.toLocaleString("tr-TR")} ₺</dd></div>)}
                {v.listing.zoning && (<div><dt className="text-gri">İmar</dt><dd className="mt-0.5 font-bold">{v.listing.zoning}</dd></div>)}
                {v.listing.officeName && (<div className="min-w-0"><dt className="text-gri">Ofis</dt><dd className="mt-0.5 truncate font-bold">{v.listing.officeName}</dd></div>)}
                {v.listing.phone && (<div><dt className="text-gri">Telefon</dt><dd className="mt-0.5 font-bold">{v.listing.phone}</dd></div>)}
              </dl>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
