"use client";
import { templateList, type TemplateCategory, type TemplateInfo } from "@arsa/shared";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveOnboarding } from "./actions";

const CATS: { id: TemplateCategory; title: string; sub: string }[] = [
  { id: "Arsa", title: "Arsa ve tarla", sub: "İmarlı arsa, tarla, bahçe" },
  { id: "Konut", title: "Konut", sub: "Daire, villa, müstakil ev" },
  { id: "Proje", title: "Proje ve inşaat", sub: "Yapılacak ya da süren projeler" },
];
const live = CATS.filter((c) => templateList.some((t) => t.category === c.id));

/** İlk girişte iki adım: ilan türleri → o türlere uyan şablonlar büyük önizlemeyle. */
export function Onboarding({ name, needsTerms, next, initial }: { name: string; needsTerms: boolean; next?: string; initial: string[] }) {
  const router = useRouter();
  const [picked, setPicked] = useState<string[]>(initial);
  const [terms, setTerms] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const first = name.split(" ")[0];

  const toggle = (c: string) => setPicked((p) => (p.includes(c) ? p.filter((x) => x !== c) : [...p, c]));
  const suggested = templateList.filter((t) => !picked.length || picked.includes(t.category));

  function submit() {
    setError(null);
    start(async () => {
      const res = await saveOnboarding({ segments: picked, terms });
      if ("error" in res) return setError(res.error ?? "Bir hata oluştu");
      if (next) router.replace(next);
      else setStep(2);
    });
  }

  if (step === 2)
    return (
      <div>
        <p className="text-sm font-bold text-gok">2 / 2</p>
        <h1 className="mt-1 text-[1.75rem] leading-tight font-extrabold tracking-[-0.03em] sm:text-[2.25rem]">Size uygun şablonlar</h1>
        <p className="mt-2 max-w-2xl text-[1.0625rem] leading-snug text-gri">
          Birini seçin; şablon yalnız gerekenleri sorar. İstediğiniz zaman tüm şablonlara dönebilirsiniz.
        </p>
        <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {suggested.map((t) => (
            <Suggestion key={t.id} t={t} />
          ))}
        </div>
        <div className="mt-10 flex flex-wrap items-center gap-3">
          <Link href="/panel" className="pnl-btn-ghost">
            Tüm şablonları görün
          </Link>
          <button type="button" onClick={() => setStep(1)} className="pnl-btn px-3 text-gri hover:text-gok">
            Seçimi değiştirin
          </button>
        </div>
      </div>
    );

  return (
    <div className="max-w-3xl">
      <p className="text-sm font-bold text-gok">1 / 2</p>
      <h1 className="mt-1 text-[1.75rem] leading-tight font-extrabold tracking-[-0.03em] sm:text-[2.25rem]">
        Hoş geldiniz{first ? `, ${first}` : ""}
      </h1>
      <p className="mt-2 text-[1.0625rem] leading-snug text-gri">Ne tür ilanlarla çalışıyorsunuz? Size uygun şablonları öne çıkaralım. Birden fazla seçebilirsiniz.</p>

      <div role="group" aria-label="İlan türleri" className="mt-8 grid gap-3 sm:grid-cols-3">
        {live.map((c) => {
          const on = picked.includes(c.id);
          const cover = templateList.find((t) => t.category === c.id)!.preview.poster;
          return (
            <button
              key={c.id}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(c.id)}
              className={`group overflow-hidden rounded-2xl border-2 bg-white text-left transition ${on ? "border-gok shadow-[0_12px_28px_-16px_rgba(43,108,255,.8)]" : "border-ayrac hover:border-gok/50"}`}
            >
              <span className="relative block aspect-[16/10] overflow-hidden bg-gok-acik">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={cover} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
                <span
                  className={`absolute top-2.5 right-2.5 flex h-7 w-7 items-center justify-center rounded-full border-2 ${on ? "border-gok bg-gok text-white" : "border-white bg-white/70 text-transparent"}`}
                  aria-hidden
                >
                  <svg viewBox="0 0 20 20" className="h-4 w-4"><path d="M5 10.5l3.2 3L15 7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </span>
              </span>
              <span className="block p-4">
                <span className="block text-[1.0625rem] font-extrabold">{c.title}</span>
                <span className="mt-0.5 block text-sm text-gri">{c.sub}</span>
              </span>
            </button>
          );
        })}
      </div>

      {needsTerms && (
        <label className="mt-6 flex items-start gap-3 text-sm leading-relaxed text-gri">
          <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-gok" />
          <span>
            <Link href="/kullanim-kosullari" target="_blank" className="font-bold text-lacivert underline decoration-ayrac underline-offset-2 hover:text-gok">
              Kullanım koşullarını
            </Link>{" "}
            okudum, kabul ediyorum. Kişisel verilerim{" "}
            <Link href="/kvkk" target="_blank" className="font-bold text-lacivert underline decoration-ayrac underline-offset-2 hover:text-gok">
              KVKK aydınlatma metni
            </Link>{" "}
            kapsamında işlenir.
          </span>
        </label>
      )}

      {error && (
        <p role="alert" className="mt-5 rounded-xl border border-mercan/30 bg-mercan-acik px-4 py-3 text-sm font-semibold text-mercan-koyu">
          {error}
        </p>
      )}

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <button type="button" onClick={submit} disabled={pending || (needsTerms && !terms)} className="pnl-btn-primary px-6">
          {pending ? "Kaydediliyor…" : next ? "Devam edin" : picked.length ? "Şablonları gösterin" : "Tüm şablonları gösterin"}
        </button>
      </div>
    </div>
  );
}

function Suggestion({ t }: { t: TemplateInfo }) {
  return (
    <article className="pnl-kart flex flex-col overflow-hidden">
      <div className="relative aspect-[4/5] bg-gok-acik sm:aspect-[16/12]">
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
        {t.badge && <span className="absolute top-3 left-3 rounded-full bg-gunes px-2.5 py-0.5 text-xs font-bold text-lacivert">{t.badge}</span>}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <p className="text-[0.8125rem] font-semibold text-gri">
          {t.category} · <span className="tabular-nums">{t.duration}</span>
        </p>
        <h2 className="mt-1 text-xl leading-tight font-extrabold tracking-[-0.02em]">{t.name}</h2>
        <p className="mt-1.5 text-[0.9375rem] leading-snug text-gri">{t.tagline}</p>
        <p className="mt-4 text-[0.8125rem] font-bold tracking-wide text-lacivert uppercase">Hazırlamanız gerekenler</p>
        <ul className="mt-1.5 space-y-1 text-sm leading-snug text-gri">
          {t.needs.map((n) => (
            <li key={n} className="flex gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gok" aria-hidden />
              {n}
            </li>
          ))}
        </ul>
        <div className="mt-auto pt-5">
          <Link href={`/panel/yeni/${t.id}`} className="pnl-btn-primary w-full">
            Bu şablonla başlayın
          </Link>
        </div>
      </div>
    </article>
  );
}
