import { estimateCostTry, TEMPLATES, TOUR_QUALITY, TourQuality, videoCredits, type PricingSettings, type TemplateId, type TemplateInput } from "@arsa/shared";
import { savePricing } from "@/app/admin/actions";
import { PageTitle } from "@/components/admin/ui";
import { getPricing } from "@/lib/credits";
import { formatTry } from "@/lib/format";
import { requireAdmin } from "@/lib/auth";

function Field({ name, label, value, unit }: { name: string; label: string; value: number; unit?: string }) {
  return (
    <div>
      <label className="adm-label" htmlFor={name}>{label}</label>
      <div className="flex items-center gap-2">
        <input id={name} name={name} defaultValue={String(value)} inputMode="decimal" required className="adm-input" />
        {unit ? <span className="w-10 shrink-0 text-sm font-semibold text-gri">{unit}</span> : null}
      </div>
    </div>
  );
}

const n = (id: TemplateId) => TEMPLATES[id].name;

/** Hesap özetindeki örnek siparişler: fotoğraf/oda/sahne sayısı maliyeti değiştiren şablonlar için tipik değer. */
const SAMPLES: { id: TemplateId; label: string; photos?: number; quality?: "orta" | "yuksek" }[] = [
  { id: "arsa-drone", label: n("arsa-drone") },
  { id: "ilan-videosu", label: `${n("ilan-videosu")} · 5 fotoğraf`, photos: 5 },
  { id: "bitmis-hali", label: n("bitmis-hali") },
  { id: "insaat-videosu", label: n("insaat-videosu") },
  { id: "dosenmis-ev", label: `${n("dosenmis-ev")} · 3 oda`, photos: 3 },
  { id: "sunucu-ev", label: `${n("sunucu-ev")} · 4 sahne, orta`, photos: 4, quality: "orta" },
  { id: "sunucu-ev", label: `${n("sunucu-ev")} · 4 sahne, yüksek`, photos: 4, quality: "yuksek" },
];

function sample(s: (typeof SAMPLES)[number], p: PricingSettings) {
  const input = { photos: Array.from({ length: s.photos ?? 0 }, () => ({})), quality: s.quality } as unknown as TemplateInput;
  const cost = estimateCostTry(s.id, input, p);
  const revenue = videoCredits(s.id, input, p) * p.creditPriceTry;
  return { cost, revenue, credits: videoCredits(s.id, input, p) };
}

/** Sunuculu turda bir sahnenin maliyet dökümü ($): Higgsfield kredisi × kredi değeri + ek. */
function sceneUsd(q: "orta" | "yuksek", p: PricingSettings) {
  const c = p.costUsd["sunucu-ev"];
  return c.higgsfieldPerScene[q] * p.higgsfieldCreditUsd + c.extraUsdPerScene;
}

export default async function SettingsPage() {
  // Yerleşim de denetler; sayfa yerleşimle paralel çalıştığı için veri sorgusundan önce burada da.
  await requireAdmin();
  const p = await getPricing();
  const c = p.costUsd;
  return (
    <>
      <PageTitle sub="Maliyet tahmini ve sipariş kredisi bu değerlerle hesaplanır. Gerçek maliyeti video sayfasından tek tek girebilirsiniz.">Ayarlar</PageTitle>
      <form action={savePricing} className="max-w-4xl space-y-3">
        <section className="adm-kart grid gap-4 p-5 sm:grid-cols-3">
          <h2 className="font-extrabold sm:col-span-3">Genel</h2>
          <Field name="creditPriceTry" label="1 kredinin fiyatı" value={p.creditPriceTry} unit="₺" />
          <Field name="usdTry" label="Dolar kuru" value={p.usdTry} unit="₺" />
          <Field name="higgsfieldCreditUsd" label="Higgsfield plan kredisi" value={p.higgsfieldCreditUsd} unit="$" />
        </section>

        <section className="adm-kart grid gap-4 p-5 sm:grid-cols-3">
          <h2 className="font-extrabold sm:col-span-3">Sipariş kredisi (video başına)</h2>
          {(Object.keys(p.credits) as (keyof typeof p.credits)[]).map((id) => (
            <Field key={id} name={`credits.${id}`} label={n(id)} value={p.credits[id]} unit="kredi" />
          ))}
          {TourQuality.options.map((q) => (
            <Field key={q} name={`tourCredits.${q}`} label={`${n("sunucu-ev")} · ${TOUR_QUALITY[q].label.toLowerCase()}, sahne başına`} value={p.tourCredits[q]} unit="kredi" />
          ))}
        </section>

        <section className="adm-kart grid gap-4 p-5 sm:grid-cols-3">
          <h2 className="font-extrabold sm:col-span-3">Tahmini maliyet</h2>
          <Field name="costUsd.arsa-drone" label={n("arsa-drone")} value={c["arsa-drone"]} unit="$" />
          <Field name="costUsd.bitmis-hali" label={n("bitmis-hali")} value={c["bitmis-hali"]} unit="$" />
          <Field name="costUsd.insaat-videosu" label={n("insaat-videosu")} value={c["insaat-videosu"]} unit="$" />
          <Field name="costUsd.ilan-videosu.perPhoto" label={`${n("ilan-videosu")} · fotoğraf başına`} value={c["ilan-videosu"].perPhoto} unit="$" />
          <Field name="costUsd.dosenmis-ev.base" label={`${n("dosenmis-ev")} · sabit`} value={c["dosenmis-ev"].base} unit="$" />
          <Field name="costUsd.dosenmis-ev.perRoom" label={`${n("dosenmis-ev")} · oda başına`} value={c["dosenmis-ev"].perRoom} unit="$" />
          <Field name="costUsd.sunucu-ev.higgsfieldPerScene.orta" label={`${n("sunucu-ev")} · orta, Higgsfield kredisi/sahne`} value={c["sunucu-ev"].higgsfieldPerScene.orta} unit="HF" />
          <Field name="costUsd.sunucu-ev.higgsfieldPerScene.yuksek" label={`${n("sunucu-ev")} · yüksek, Higgsfield kredisi/sahne`} value={c["sunucu-ev"].higgsfieldPerScene.yuksek} unit="HF" />
          <Field name="costUsd.sunucu-ev.extraUsdPerScene" label={`${n("sunucu-ev")} · ek maliyet, sahne başına`} value={c["sunucu-ev"].extraUsdPerScene} unit="$" />
        </section>
        <section className="adm-kart p-5">
          <h2 className="font-extrabold">Hesap özeti</h2>
          <p className="mt-1 text-sm text-gri">
            Kayıtlı değerlerle örnek siparişler. Sunuculu tur sahnesi: orta {formatTry(sceneUsd("orta", p) * p.usdTry)} (${sceneUsd("orta", p).toFixed(2)}), yüksek{" "}
            {formatTry(sceneUsd("yuksek", p) * p.usdTry)} (${sceneUsd("yuksek", p).toFixed(2)}); kare 2,5 + klip (360p 10 / 720p 30) + büyütme 4 kredi.
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[30rem] text-sm">
              <thead>
                <tr className="text-left text-gri">
                  <th className="py-2 font-semibold">Video</th>
                  <th className="py-2 text-right font-semibold">Maliyet</th>
                  <th className="py-2 text-right font-semibold">Kredi</th>
                  <th className="py-2 text-right font-semibold">Gelir</th>
                  <th className="py-2 text-right font-semibold">Kâr</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {SAMPLES.map((s) => {
                  const r = sample(s, p);
                  return (
                    <tr key={s.label} className="border-t border-black/5">
                      <td className="py-2">{s.label}</td>
                      <td className="py-2 text-right">{formatTry(r.cost)}</td>
                      <td className="py-2 text-right">{r.credits}</td>
                      <td className="py-2 text-right">{formatTry(r.revenue)}</td>
                      <td className={`py-2 text-right font-semibold ${r.revenue - r.cost < 0 ? "text-mercan-koyu" : "text-cimen-koyu"}`}>{formatTry(r.revenue - r.cost)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
        <div className="pt-3">
          <button className="adm-btn-primary px-6">Kaydet</button>
        </div>
      </form>
    </>
  );
}
