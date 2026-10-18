import Link from "next/link";
import { VideoGrid } from "@/components/panel/VideoGrid";
import { userVideos } from "@/components/panel/videos";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Videolarım · Arsa Video" };

export default async function VideosPage() {
  const user = await requireUser();
  const rows = await userVideos(user.id);
  return (
    <>
      <h1 className="mb-6 font-display text-3xl font-bold tracking-[-0.025em]">Videolarım</h1>
      {rows.length ? (
        <VideoGrid rows={rows} />
      ) : (
        <div className="card max-w-xl p-8">
          <h2 className="text-lg font-bold">Henüz videonuz yok</h2>
          <p className="mt-2 text-mute">Bir şablon seçip ilk videonuzu oluşturun.</p>
          <Link href="/panel" className="btn-primary mt-5">Şablonlara gidin</Link>
        </div>
      )}
    </>
  );
}
