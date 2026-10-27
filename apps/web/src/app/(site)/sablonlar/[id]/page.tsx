import { TEMPLATES, TemplateId, templateList } from "@arsa/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ReelPlayer } from "@/components/site/ReelPlayer";
import { SonCagri } from "@/components/site/SonCagri";
import { createHref, tutorials } from "@/lib/tutorials";
import { TemplateCard } from "@/components/templates/TemplateCard";

export const generateStaticParams = () => templateList.map((t) => ({ id: t.id }));

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const id = TemplateId.safeParse((await params).id);
  if (!id.success) return {};
  const t = TEMPLATES[id.data];
  return { title: t.name, description: t.description, alternates: { canonical: `/sablonlar/${t.id}` } };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const id = TemplateId.safeParse((await params).id);
  if (!id.success || TEMPLATES[id.data].hidden) notFound();
  const t = TEMPLATES[id.data];
  const others = templateList.filter((o) => o.id !== t.id);
  const hasHowTo = tutorials.some((x) => x.template.id === t.id);

  return (
    <>
      <section className="mx-auto grid max-w-[1240px] gap-12 px-4 pt-10 pb-20 sm:px-6 md:grid-cols-[minmax(0,360px)_1fr] md:gap-16 md:pt-16">
        <div className="mx-auto w-full max-w-[340px]">
          {t.preview.video ? (
            <ReelPlayer src={t.preview.video} poster={t.preview.poster} label={`${t.name} örnek videosu`} />
          ) : (
            <figure>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={t.preview.poster}
                alt={`${t.name}: başlangıç karesi`}
                className="aspect-[9/16] w-full rounded-[2.25rem] border-[8px] border-lacivert object-cover shadow-[0_40px_80px_-30px_rgba(13,27,62,.55)]"
              />
              <figcaption className="mt-3 text-center text-sm text-gri">
                Başlangıç karesi. Örnek video yakında.
              </figcaption>
            </figure>
          )}
        </div>

        <div className="max-w-xl">
          <Link href="/sablonlar" className="site-etiket hover:bg-gok hover:text-white">
            ← Tüm şablonlar
          </Link>
          <h1 className="mt-5 text-[clamp(2.25rem,4.5vw,3.75rem)] leading-[1.03] font-extrabold tracking-[-0.04em] text-balance">
            {t.name}
          </h1>
          <p className="mt-5 text-[1.125rem] leading-relaxed text-gri">{t.description}</p>

          <dl className="mt-8 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-2xl bg-white px-4 py-3 shadow-[0_1px_2px_rgba(13,27,62,.05)]">
              <dt className="text-gri">Tür</dt>
              <dd className="mt-1 font-bold">{t.category}</dd>
            </div>
            <div className="rounded-2xl bg-white px-4 py-3 shadow-[0_1px_2px_rgba(13,27,62,.05)]">
              <dt className="text-gri">Süre</dt>
              <dd className="mt-1 font-bold tabular-nums">{t.duration} · dikey 9:16</dd>
            </div>
          </dl>

          <div className="mt-10 grid gap-10 sm:grid-cols-2">
            <div>
              <h2 className="text-lg font-extrabold">Hazırlamanız gerekenler</h2>
              <ul className="mt-3 space-y-2.5 text-[1rem] text-gri">
                {t.needs.map((n) => (
                  <li key={n} className="flex gap-2.5">
                    <span aria-hidden className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-cimen-acik text-xs text-cimen">
                      ✓
                    </span>
                    {n}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h2 className="text-lg font-extrabold">Videoda olanlar</h2>
              <ul className="mt-3 space-y-2.5 text-[1rem] text-gri">
                {t.includes.map((n) => (
                  <li key={n} className="flex gap-2.5">
                    <span aria-hidden className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-cimen-acik text-xs text-cimen">
                      ✓
                    </span>
                    {n}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-3">
            <Link href={createHref(t.id)} className="site-btn-primary h-14 px-8 text-base">
              Hemen oluşturun
            </Link>
            {hasHowTo && (
              <Link href={`/nasil-yapilir#nasil-tab-${t.id}`} className="site-btn-secondary h-14 px-6 text-base">
                Nasıl yapılır izleyin
              </Link>
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1240px] px-4 pb-24 sm:px-6">
        <h2 className="text-2xl font-extrabold tracking-[-0.03em]">Diğer şablonlar</h2>
        <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-5">
          {others.map((o) => (
            <TemplateCard key={o.id} t={o} href={`/sablonlar/${o.id}`} tone="light" />
          ))}
        </div>
      </section>
      <SonCagri />
    </>
  );
}
