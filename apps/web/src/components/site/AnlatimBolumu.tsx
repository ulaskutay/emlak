import Link from "next/link";
import type { ReactNode } from "react";

export type Adim = { baslik: string; text: string };

type Props = {
  etiket: ReactNode;
  baslik: string;
  text: string;
  adimlar: Adim[];
  birincil: { href: string; label: string };
  ikincil: { href: string; label: string };
  cizim: ReactNode;
  /** Çizimin arkasındaki renkli parıltı (gradient sınıfları). */
  parilti: string;
  /** Çizim sağda, yazı solda. */
  ters?: boolean;
};

/** Ana sayfa şablon anlatımı: bir yanda animasyonlu çizim, öbür yanda üç adım ve iki buton. */
export function AnlatimBolumu({ etiket, baslik, text, adimlar, birincil, ikincil, cizim, parilti, ters }: Props) {
  return (
    <section className="mx-auto max-w-[1240px] px-4 pb-24 sm:px-6">
      <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <div aria-hidden className={`relative mx-auto w-full max-w-[540px] ${ters ? "lg:order-2" : ""}`}>
          <div className={`absolute inset-6 rounded-full blur-3xl ${parilti}`} />
          <div className="relative drop-shadow-[0_30px_40px_-20px_rgba(13,27,62,.45)]">{cizim}</div>
        </div>

        <div className="text-center lg:text-left">
          <span className="site-etiket">{etiket}</span>
          <h2 className="mt-4 text-[clamp(2rem,4vw,3rem)] leading-[1.08] font-extrabold tracking-[-0.035em] text-balance">{baslik}</h2>
          <p className="mx-auto mt-4 max-w-xl text-[1.0625rem] leading-relaxed text-gri lg:mx-0">{text}</p>
          <ol className="mx-auto mt-8 max-w-xl space-y-5 text-left lg:mx-0">
            {adimlar.map((a, i) => (
              <li key={a.baslik} className="flex gap-4">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gok-acik font-extrabold text-gok">{i + 1}</span>
                <div>
                  <div className="font-bold">{a.baslik}</div>
                  <p className="mt-0.5 text-gri">{a.text}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-9 flex flex-wrap justify-center gap-3 lg:justify-start">
            <Link href={birincil.href} className="site-btn-primary h-13 px-7">
              {birincil.label}
            </Link>
            <Link href={ikincil.href} className="site-btn-secondary h-13 px-6">
              {ikincil.label}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
