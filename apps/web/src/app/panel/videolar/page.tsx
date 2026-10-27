import Link from "next/link";
import { VideoGrid } from "@/components/panel/VideoGrid";
import { PanelTitle } from "@/components/panel/ui";
import { userVideos } from "@/components/panel/videos";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Videolarım · Arsa Video" };

export default async function VideosPage() {
  const user = await requireUser();
  const rows = await userVideos(user.id);
  const working = rows.filter((v) => v.status === "queued" || v.status === "running").length;
  return (
    <>
      <PanelTitle
        sub={rows.length ? `${rows.length} video${working ? ` · ${working} tanesi hazırlanıyor` : ""}` : undefined}
        aside={rows.length ? <Link href="/panel" className="pnl-btn-primary">Yeni video</Link> : undefined}
      >
        Videolarım
      </PanelTitle>
      {rows.length ? (
        <VideoGrid rows={rows} />
      ) : (
        <div className="pnl-kart flex flex-col items-center px-6 py-14 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-gok-acik text-gok">
            <svg viewBox="0 0 20 20" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <rect x="3" y="4" width="11" height="12" rx="2" /><path d="m14 8.5 3.5-2v7l-3.5-2" />
            </svg>
          </span>
          <h2 className="mt-4 text-lg font-extrabold">Henüz videonuz yok</h2>
          <p className="mt-1.5 max-w-sm text-sm text-gri">Bir şablon seçin, birkaç bilgi girin; videonuz birkaç dakikada burada hazır olur.</p>
          <Link href="/panel" className="pnl-btn-primary mt-6">Şablonlara gidin</Link>
        </div>
      )}
    </>
  );
}
