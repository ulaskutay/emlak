import Link from "next/link";
import { redirect } from "next/navigation";
import { VideoGrid } from "@/components/panel/VideoGrid";
import { PanelTitle } from "@/components/panel/ui";
import { userVideos } from "@/components/panel/videos";
import { FeaturedTemplate } from "@/components/templates/FeaturedTemplate";
import { TemplateGallery } from "@/components/templates/TemplateGallery";
import { requireUser } from "@/lib/auth";
import { onboardingState } from "@/lib/onboarding";

export const dynamic = "force-dynamic";
export const metadata = { title: "Şablonlar · Arsa Video" };

export default async function PanelHome() {
  const user = await requireUser();
  const [recent, state] = await Promise.all([userVideos(user.id, 5), onboardingState(user.id)]);
  // İlk kez gelen (karşılamayı görmemiş, hiç videosu olmayan) kullanıcı önce karşılamaya.
  if (!state.onboardedAt && recent.length === 0) redirect("/panel/hosgeldin");
  const prefer = state.segments ?? [];
  return (
    <>
      <PanelTitle sub="Şablonu seçin; gereken bilgileri o şablon soracak.">Hangi videoyu hazırlayalım?</PanelTitle>
      <FeaturedTemplate prefer={prefer} />
      <TemplateGallery tone="light" hrefBase="/panel/yeni/" prefer={prefer} />

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
