import { creditLedger, desc, eq, getDb } from "@arsa/db";
import { TEMPLATES, videoCredits, type TemplateId, type TemplateInput } from "@arsa/shared";
import Link from "next/link";
import { PanelTitle } from "@/components/panel/ui";
import { requireUser } from "@/lib/auth";
import { creditBalance, getPricing } from "@/lib/credits";
import { formatDate, formatInt, formatTry } from "@/lib/format";
import { paytrEnabled } from "@/lib/paytr";
import { BuyPackage, LeaveIframe } from "./BuyPackage";

export const dynamic = "force-dynamic";
export const metadata = { title: "Kredi · Arsa Video" };

const REASON: Record<string, string> = { admin: "Düzenleme", purchase: "Satın alma", video: "Video", refund: "İade", welcome: "Hoş geldin kredisi" };

/** Kredi karşılığı örnekleri: kullanıcı paketin kaç videoya yettiğini görsün. */
const EXAMPLES: { id: TemplateId; label: string; photos?: number }[] = [
  { id: "ilan-videosu", label: TEMPLATES["ilan-videosu"].name },
  { id: "arsa-drone", label: TEMPLATES["arsa-drone"].name },
  { id: "dosenmis-ev", label: TEMPLATES["dosenmis-ev"].name },
  { id: "insaat-videosu", label: TEMPLATES["insaat-videosu"].name },
];

export default async function CreditsPage({ searchParams }: { searchParams: Promise<{ odeme?: string }> }) {
  const user = await requireUser();
  const { odeme } = await searchParams;
  const [balance, pricing, ledger] = await Promise.all([
    creditBalance(user.id),
    getPricing(),
    getDb().select().from(creditLedger).where(eq(creditLedger.userId, user.id)).orderBy(desc(creditLedger.createdAt)).limit(50),
  ]);
  const cheapest = Math.min(...pricing.packages.map((p) => p.priceTry / p.credits));
  const examples = EXAMPLES.filter((e) => !TEMPLATES[e.id].hidden).map((e) => ({
    ...e,
    credits: videoCredits(e.id, { photos: Array.from({ length: e.photos ?? 0 }) } as unknown as TemplateInput, pricing),
  }));

  return (
    <>
      <PanelTitle sub="Her video siparişte kredisi kadar düşer. Video üretilemezse kredi kendiliğinden geri yüklenir.">Kredi</PanelTitle>

      {odeme ? <LeaveIframe /> : null}
      {odeme === "tamam" ? (
        <p className="mb-6 rounded-xl bg-cimen-acik px-4 py-3 text-sm font-semibold text-cimen-koyu">
          Ödemeniz alındı. Kredi, ödeme onayı gelince birkaç saniye içinde bakiyenize eklenir; görmüyorsanız sayfayı yenileyin.
        </p>
      ) : odeme === "hata" ? (
        <p className="mb-6 rounded-xl bg-mercan-acik px-4 py-3 text-sm font-semibold text-mercan-koyu">Ödeme tamamlanamadı, kartınızdan çekim yapılmadı. Tekrar deneyebilirsiniz.</p>
      ) : null}

      <section className="pnl-kart mb-8 flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6">
        <div>
          <div className="text-sm font-semibold text-gri">Bakiyeniz</div>
          <div className={`mt-1 text-4xl font-extrabold tabular-nums tracking-[-0.03em] ${balance < 0 ? "text-mercan-koyu" : ""}`}>
            {formatInt(balance)} <span className="text-lg font-bold text-gri">kredi</span>
          </div>
        </div>
        <ul className="grid gap-1 text-sm text-gri sm:text-right">
          {examples.map((e) => (
            <li key={e.id}>
              {e.label}: <span className="font-semibold text-lacivert">{e.credits} kredi</span>
            </li>
          ))}
        </ul>
      </section>

      <h2 className="mb-3 text-lg font-extrabold tracking-[-0.02em]">Kredi paketleri</h2>
      <div className="grid gap-3 md:grid-cols-3">
        {pricing.packages.map((p, i) => {
          const unit = p.priceTry / p.credits;
          const featured = i === 1 && pricing.packages.length > 2;
          return (
            <div key={p.id} className={`pnl-kart flex flex-col p-5 ${featured ? "border-gok ring-2 ring-gok/20" : ""}`}>
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-extrabold">{p.name}</h3>
                {unit <= cheapest && i > 0 ? <span className="rounded-full bg-cimen-acik px-2.5 py-1 text-xs font-bold text-cimen-koyu">En uygun</span> : null}
              </div>
              <div className="mt-3 text-3xl font-extrabold tabular-nums tracking-[-0.03em]">{formatInt(p.credits)} <span className="text-base font-bold text-gri">kredi</span></div>
              <div className="mt-1 text-sm text-gri">
                {formatTry(p.priceTry)} · kredisi {unit.toLocaleString("tr-TR", { maximumFractionDigits: 2 })} ₺
              </div>
              <BuyPackage pack={p} enabled={paytrEnabled()} featured={featured} />
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-gri">
        Fiyatlara KDV dahildir. Ödeme PayTR güvenli ödeme sayfasında yapılır, kart bilgileriniz bize ulaşmaz. Havale/EFT için{" "}
        <Link href="/iletisim" className="font-semibold text-gok">bize yazın</Link>.
      </p>

      <h2 className="mb-3 mt-10 text-lg font-extrabold tracking-[-0.02em]">Kredi hareketleri</h2>
      {ledger.length ? (
        <div className="pnl-kart overflow-hidden">
          <ul className="divide-y divide-ayrac">
            {ledger.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-4 px-4 py-3 sm:px-5">
                <div className="min-w-0">
                  <div className="text-sm font-semibold">
                    {l.videoId ? <Link href={`/panel/videolar/${l.videoId}`} className="hover:text-gok">{REASON[l.reason] ?? l.reason}</Link> : REASON[l.reason] ?? l.reason}
                    {l.note && !l.createdBy && l.reason !== "welcome" ? <span className="font-normal text-gri"> · {l.note}</span> : null}
                  </div>
                  <div className="text-xs text-gri">{formatDate(l.createdAt)}</div>
                </div>
                <div className={`shrink-0 font-bold tabular-nums ${l.delta > 0 ? "text-cimen-koyu" : "text-lacivert"}`}>
                  {l.delta > 0 ? "+" : ""}
                  {formatInt(l.delta)}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="pnl-kart px-5 py-8 text-center text-sm text-gri">Henüz kredi hareketi yok.</p>
      )}
    </>
  );
}
