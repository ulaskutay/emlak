import { TEMPLATES } from "@arsa/shared";
import Link from "next/link";
import { overallProgress, videoTitle } from "@/components/status";
import { formatDate, parcelPlace } from "@/lib/format";
import { ProgressBar, StatusBadge } from "./ui";
import type { UserVideo } from "./videos";

export function VideoGrid({ rows }: { rows: UserVideo[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
      {rows.map((v) => {
        const working = v.status === "running";
        return (
          <Link
            key={v.id}
            href={`/panel/videolar/${v.id}`}
            className="pnl-kart group flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:border-gok/40 hover:shadow-[0_16px_32px_-20px_rgba(13,27,62,.35)]"
          >
            <div className="relative aspect-[9/16] overflow-hidden bg-gradient-to-b from-gok-acik to-[#dbe6ff]">
              {v.poster ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={v.poster} alt="" className={`h-full w-full object-cover transition duration-500 group-hover:scale-[1.03] ${working ? "opacity-60" : ""}`} />
              ) : (
                <div className="grid h-full place-items-center">
                  <svg viewBox="0 0 20 20" className="h-10 w-10 text-gok/40" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <rect x="3" y="4" width="11" height="12" rx="2" /><path d="m14 8.5 3.5-2v7l-3.5-2" />
                  </svg>
                </div>
              )}
              <StatusBadge status={v.status} stage={v.stage} template={v.template} className="absolute top-2 left-2 max-w-[calc(100%-1rem)] truncate shadow-sm" />
              {working ? (
                <div className="absolute inset-x-2 bottom-2 rounded-xl bg-white/90 px-2.5 py-2 backdrop-blur">
                  <div className="mb-1.5 flex justify-between text-[0.6875rem] font-bold text-lacivert">
                    <span>Üretiliyor</span>
                    <span className="tabular-nums">%{Math.round(overallProgress(v.status, v.stage, v.progress, v.template) * 100)}</span>
                  </div>
                  <ProgressBar value={overallProgress(v.status, v.stage, v.progress, v.template)} className="h-1.5" />
                </div>
              ) : null}
            </div>
            <div className="flex flex-1 flex-col p-3 sm:p-3.5">
              <div className="line-clamp-2 text-sm font-bold leading-snug group-hover:text-gok">{videoTitle(v)}</div>
              <div className="mt-0.5 truncate text-xs text-gri">{v.parcelSummary ? parcelPlace(v.parcelSummary) : TEMPLATES[v.template]?.name}</div>
              <div className="mt-auto pt-2 text-xs text-gri/80">{formatDate(v.createdAt)}</div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
