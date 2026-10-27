import Link from "next/link";
import { VideoGrid } from "@/components/panel/VideoGrid";
import { PanelTitle } from "@/components/panel/ui";
import { userVideos } from "@/components/panel/videos";
import { TemplateGallery } from "@/components/templates/TemplateGallery";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Şablonlar · Arsa Video" };

export default async function PanelHome() {
  const user = await requireUser();
  const recent = await userVideos(user.id, 5);
  return (
    <>
      <PanelTitle sub="Şablonu seçin; gereken bilgileri o şablon soracak.">Hangi videoyu hazırlayalım?</PanelTitle>
      <TemplateGallery tone="light" hrefBase="/panel/yeni/" />

      {recent.length > 0 && (
        <section className="mt-14 border-t border-ayrac pt-8">
          <div className="mb-5 flex items-baseline justify-between gap-4">
            <h2 className="text-xl font-extrabold tracking-[-0.02em]">Son videolarınız</h2>
            <Link href="/panel/videolar" className="inline-flex min-h-9 items-center text-sm font-bold text-gok hover:underline">
              Tümünü görün
            </Link>
          </div>
          <VideoGrid rows={recent} />
        </section>
      )}
    </>
  );
}
