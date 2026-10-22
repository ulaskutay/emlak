import { TEMPLATE_IDS, TEMPLATES, TemplateId, templateList } from "@arsa/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ReelPlayer } from "@/components/site/ReelPlayer";
import { TemplateCard } from "@/components/templates/TemplateCard";

export const generateStaticParams = () => TEMPLATE_IDS.map((id) => ({ id }));

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const id = TemplateId.safeParse((await params).id);
  if (!id.success) return {};
  const t = TEMPLATES[id.data];
  return { title: t.name, description: t.description, alternates: { canonical: `/sablonlar/${t.id}` } };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const id = TemplateId.safeParse((await params).id);
  if (!id.success) notFound();
  const t = TEMPLATES[id.data];
  const others = templateList.filter((o) => o.id !== t.id);

  return (
    <>
      <section className="mx-auto grid max-w-[1240px] gap-12 px-4 pt-6 pb-20 sm:px-6 md:grid-cols-[minmax(0,360px)_1fr] md:gap-16 md:pt-12">
        <div className="mx-auto w-full max-w-[340px]">
          {t.preview.video ? (
            <ReelPlayer src={t.preview.video} poster={t.preview.poster} label={`${t.name} örnek videosu`} tone="dark" />
          ) : (
            <figure>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={t.preview.poster}
                alt={`${t.name}: başlangıç karesi`}
                className="aspect-[9/16] w-full rounded-[2rem] border-[7px] border-[#0b100d] object-cover"
              />
              <figcaption className="mt-3 text-center text-sm text-[#8f988c]">
                Başlangıç karesi. Örnek video yakında.
              </figcaption>
            </figure>
          )}
        </div>

        <div className="max-w-xl">
          <Link href="/sablonlar" className="text-sm text-[#a9b2a6] hover:text-kagit">
            Tüm şablonlar
          </Link>
          <h1 className="mt-3 font-display text-[clamp(2.25rem,4.5vw,3.75rem)] leading-[1] font-bold tracking-[-0.03em] text-balance">
            {t.name}
          </h1>
          <p className="mt-5 text-[1.125rem] leading-relaxed text-[#c9d0c6]">{t.description}</p>

          <dl className="mt-8 grid grid-cols-2 gap-4 border-t border-white/10 pt-5 text-sm">
            <div>
              <dt className="text-[#8f988c]">Tür</dt>
              <dd className="mt-1 font-semibold">{t.category}</dd>
            </div>
            <div>
              <dt className="text-[#8f988c]">Süre</dt>
              <dd className="mt-1 font-semibold tabular-nums">{t.duration} · dikey 9:16</dd>
            </div>
          </dl>

          <div className="mt-10 grid gap-10 sm:grid-cols-2">
            <div>
              <h2 className="font-display text-lg font-semibold">Hazırlamanız gerekenler</h2>
              <ul className="mt-3 space-y-2.5 text-[1rem] text-[#c9d0c6]">
                {t.needs.map((n) => (
                  <li key={n} className="border-t border-white/10 pt-2.5">
                    {n}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h2 className="font-display text-lg font-semibold">Videoda olanlar</h2>
              <ul className="mt-3 space-y-2.5 text-[1rem] text-[#c9d0c6]">
                {t.includes.map((n) => (
                  <li key={n} className="border-t border-white/10 pt-2.5">
                    {n}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <Link href={`/panel/yeni/${t.id}`} className="site-btn-primary mt-10">
            Bu şablonu kullanın
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-[1240px] px-4 pb-24 sm:px-6">
        <h2 className="font-display text-2xl font-semibold tracking-[-0.02em]">Diğer şablonlar</h2>
        <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-5">
          {others.map((o) => (
            <TemplateCard key={o.id} t={o} href={`/sablonlar/${o.id}`} />
          ))}
        </div>
      </section>
    </>
  );
}
