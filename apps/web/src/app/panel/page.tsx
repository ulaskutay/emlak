import { desc, eq, getDb, videos } from "@arsa/db";
import Link from "next/link";
import { statusLabel, statusTone } from "@/components/status";
import { requireUser } from "@/lib/auth";
import { formatArea, formatDate, parcelPlace, parcelTitle } from "@/lib/format";
import { r2 } from "@/lib/r2";

export const dynamic = "force-dynamic";

export default async function VideosPage() {
  const user = await requireUser();
  const rows = await getDb()
    .select({
      id: videos.id,
      status: videos.status,
      stage: videos.stage,
      parcelSummary: videos.parcelSummary,
      keyframeKey: videos.keyframeKey,
      createdAt: videos.createdAt,
    })
    .from(videos)
    .where(eq(videos.userId, user.id))
    .orderBy(desc(videos.createdAt))
    .limit(100);
  const posters = await Promise.all(rows.map((v) => (v.keyframeKey ? r2().url(v.keyframeKey, 6 * 3600) : null)));

  if (!rows.length)
    return (
      <div className="card mx-auto mt-10 max-w-xl p-10 text-center">
        <h1 className="text-2xl font-extrabold">İlk videonuzu oluşturun</h1>
        <p className="mt-3 text-mute">
          TKGM Parsel Sorgu&apos;dan indirdiğiniz GeoJSON/KML dosyasını yükleyin; drone çekimi, çevre turu, seslendirme ve
          müzikli tanıtım videosu birkaç dakikada hazır.
        </p>
        <Link href="/panel/yeni" className="btn-primary mt-6">+ Yeni video</Link>
      </div>
    );

  return (
    <>
      <h1 className="mb-6 text-2xl font-extrabold">Videolarım</h1>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {rows.map((v, i) => (
          <Link key={v.id} href={`/panel/videolar/${v.id}`} className="card group overflow-hidden transition hover:border-neon/50">
            <div className="relative aspect-[9/16] bg-gradient-to-b from-[#0e1a24] to-ink">
              {posters[i] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={posters[i]!} alt="" className="h-full w-full object-cover transition group-hover:scale-[1.02]" />
              ) : (
                <div className="grid h-full place-items-center text-4xl text-neon/40">▶</div>
              )}
              <span className={`absolute left-2 top-2 rounded-full px-2.5 py-1 text-xs font-semibold ${statusTone[v.status]}`}>
                {statusLabel(v.status, v.stage)}
              </span>
            </div>
            <div className="p-3">
              <div className="truncate text-sm font-bold">{parcelTitle(v.parcelSummary)}</div>
              <div className="truncate text-xs text-mute">{parcelPlace(v.parcelSummary)}</div>
              <div className="mt-1 flex justify-between text-xs text-mute">
                <span>{formatArea(v.parcelSummary.areaM2)}</span>
                <span>{formatDate(v.createdAt)}</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
