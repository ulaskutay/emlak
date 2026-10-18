import { templateList } from "@arsa/shared";
import Link from "next/link";
import { VideoGrid } from "@/components/panel/VideoGrid";
import { userVideos } from "@/components/panel/videos";
import { TemplateCard } from "@/components/templates/TemplateCard";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Şablonlar · Arsa Video" };

export default async function PanelHome() {
  const user = await requireUser();
  const recent = await userVideos(user.id, 4);
  return (
    <>
      <h1 className="font-display text-[clamp(1.875rem,4vw,2.75rem)] leading-[1.05] font-bold tracking-[-0.03em]">
        Hangi videoyu hazırlayalım?
      </h1>
      <p className="mt-2 text-mute">Şablonu seçin; gereken bilgileri o şablon soracak.</p>
      <div className="mt-8 grid grid-cols-1 gap-x-6 gap-y-10 min-[480px]:grid-cols-2 lg:grid-cols-3">
        {templateList.map((t, i) => (
          <TemplateCard key={t.id} t={t} href={`/panel/yeni/${t.id}`} priority={i < 3} />
        ))}
      </div>

      {recent.length > 0 && (
        <section className="mt-16">
          <div className="mb-5 flex items-baseline justify-between">
            <h2 className="font-display text-2xl font-semibold tracking-[-0.02em]">Son videolarınız</h2>
            <Link href="/panel/videolar" className="text-sm font-semibold text-neon hover:underline">
              Tümünü görün
            </Link>
          </div>
          <VideoGrid rows={recent} />
        </section>
      )}
    </>
  );
}
