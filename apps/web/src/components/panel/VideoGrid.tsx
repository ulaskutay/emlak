import { TEMPLATES } from "@arsa/shared";
import Link from "next/link";
import { statusLabel, statusTone, videoTitle } from "@/components/status";
import { formatDate, parcelPlace } from "@/lib/format";
import type { UserVideo } from "./videos";

export function VideoGrid({ rows }: { rows: UserVideo[] }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {rows.map((v) => (
        <Link key={v.id} href={`/panel/videolar/${v.id}`} className="card group overflow-hidden transition hover:border-neon/50">
          <div className="relative aspect-[9/16] bg-gradient-to-b from-[#1d2a23] to-ink">
            {v.poster ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={v.poster} alt="" className="h-full w-full object-cover transition group-hover:scale-[1.02]" />
            ) : (
              <div className="grid h-full place-items-center text-4xl text-neon/40">▶</div>
            )}
            <span className={`absolute top-2 left-2 rounded-full px-2.5 py-1 text-xs font-semibold ${statusTone[v.status]}`}>
              {statusLabel(v.status, v.stage, v.template)}
            </span>
          </div>
          <div className="p-3">
            <div className="truncate text-sm font-bold">{videoTitle(v)}</div>
            <div className="truncate text-xs text-mute">{v.parcelSummary ? parcelPlace(v.parcelSummary) : TEMPLATES[v.template]?.name}</div>
            <div className="mt-1 text-xs text-mute">{formatDate(v.createdAt)}</div>
          </div>
        </Link>
      ))}
    </div>
  );
}
