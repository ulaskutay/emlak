import { templateList } from "@arsa/shared";
import Link from "next/link";

/** Panelin üstündeki öne çıkan şablon: kullanıcının ilan türünden yeni bir şablon, yoksa en yeni şablon. */
export function FeaturedTemplate({ prefer = [], credits = {} }: { prefer?: string[]; credits?: Record<string, string> }) {
  const mine = templateList.filter((t) => prefer.includes(t.category));
  const t = mine.find((x) => x.badge) ?? mine[0] ?? templateList.find((x) => x.badge) ?? templateList[0];
  if (!t) return null;
  return (
    <section aria-label="Öne çıkan şablon" className="mb-10 grid overflow-hidden rounded-3xl bg-lacivert text-white md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <div className="relative aspect-video bg-black md:aspect-auto md:min-h-[20rem]">
        {t.preview.video ? (
          <video
            src={t.preview.video}
            poster={t.preview.poster}
            muted
            loop
            playsInline
            autoPlay
            preload="metadata"
            className="absolute inset-0 h-full w-full object-cover motion-reduce:hidden"
          />
        ) : null}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={t.preview.poster} alt="" className={`absolute inset-0 h-full w-full object-cover ${t.preview.video ? "hidden motion-reduce:block" : ""}`} />
      </div>
      <div className="flex flex-col p-6 sm:p-8">
        <p className="inline-flex w-fit items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[0.8125rem] font-bold">
          <span className="h-2 w-2 rounded-full bg-gunes" aria-hidden />
          {mine.includes(t) ? "Sizin için" : "Öne çıkan"} · {t.category}
        </p>
        <h2 className="mt-4 text-[1.75rem] leading-tight font-extrabold tracking-[-0.03em]">{t.name}</h2>
        <p className="mt-2 text-[0.9375rem] leading-relaxed text-white/75">{t.tagline}</p>
        <ul className="mt-5 grid gap-x-4 gap-y-1.5 text-sm text-white/85 sm:grid-cols-2">
          {t.includes.slice(0, 4).map((x) => (
            <li key={x} className="flex gap-2">
              <svg viewBox="0 0 20 20" className="mt-0.5 h-4 w-4 shrink-0 text-gunes" aria-hidden>
                <path d="M5 10.5l3.2 3L15 7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {x}
            </li>
          ))}
        </ul>
        <div className="mt-auto flex flex-wrap items-center gap-3 pt-6">
          <Link href={`/panel/yeni/${t.id}`} className="pnl-btn bg-gunes px-6 text-lacivert hover:bg-[#ffbf1a]">
            Hemen oluşturun
          </Link>
          <span className="text-sm text-white/60 tabular-nums">
            {t.duration}
            {credits[t.id] && <> · <span className="font-bold text-gunes">{credits[t.id]}</span></>}
          </span>
        </div>
      </div>
    </section>
  );
}
