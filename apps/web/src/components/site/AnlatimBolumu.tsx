import Link from "next/link";
import type { ReactNode } from "react";
import { VizorCercevesi } from "./VizorCercevesi";

export type Adim = { baslik: string; text: string };

type Props = {
  /** Başlığın üstündeki kısa satır: şablon türü. */
  etiket: string;
  baslik: string;
  text: string;
  adimlar: Adim[];
  birincil: { href: string; label: string };
  ikincil: { href: string; label: string };
  cizim: ReactNode;
  /** Çizim sağda, yazı solda. */
  ters?: boolean;
};

/** Ana sayfa şablon anlatımı: bir yanda vizör çerçevesinde animasyonlu çizim, öbür yanda künye gibi dizilmiş üç adım ve iki buton. */
export function AnlatimBolumu({ etiket, baslik, text, adimlar, birincil, ikincil, cizim, ters }: Props) {
  return (
    <section className="mx-auto max-w-[1240px] px-4 pb-24 sm:px-6">
      <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <div aria-hidden className={`relative mx-auto w-full max-w-[540px] ${ters ? "lg:order-2" : ""}`}>
          <VizorCercevesi className="p-5 sm:p-7">{cizim}</VizorCercevesi>
        </div>

        <div className="text-center lg:text-left">
          <p className="text-[0.9375rem] font-semibold text-gok">{etiket}</p>
          <h2 className="mt-4 text-[clamp(2rem,4vw,3rem)] leading-[1.08] font-extrabold tracking-[-0.035em] text-balance">{baslik}</h2>
          <p className="mx-auto mt-4 max-w-xl text-[1.0625rem] leading-relaxed text-gri lg:mx-0">{text}</p>
          <ol className="mx-auto mt-8 max-w-xl border-b border-ayrac text-left lg:mx-0">
            {adimlar.map((a, i) => (
              <li key={a.baslik} className="grid grid-cols-[2rem_1fr] gap-x-3 border-t border-ayrac py-4">
                <span className="pt-px font-extrabold text-gok tabular-nums">{i + 1}</span>
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
