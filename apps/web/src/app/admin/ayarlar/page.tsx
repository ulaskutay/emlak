import { TEMPLATES, TOUR_QUALITY, type TemplateId } from "@arsa/shared";
import { savePricing } from "@/app/admin/actions";
import { PageTitle } from "@/components/admin/ui";
import { getPricing } from "@/lib/credits";

function Field({ name, label, value, unit }: { name: string; label: string; value: number; unit?: string }) {
  return (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      <div className="flex items-center gap-2">
        <input id={name} name={name} defaultValue={String(value)} inputMode="decimal" required className="input" />
        {unit ? <span className="w-10 shrink-0 text-sm text-mute">{unit}</span> : null}
      </div>
    </div>
  );
}

const n = (id: TemplateId) => TEMPLATES[id].name;

export default async function SettingsPage() {
  const p = await getPricing();
  const c = p.costUsd;
  return (
    <>
      <PageTitle sub="Maliyet tahmini ve sipariş kredisi bu değerlerle hesaplanır. Gerçek maliyeti video sayfasından tek tek girebilirsiniz.">Ayarlar</PageTitle>
      <form action={savePricing} className="max-w-4xl space-y-6">
        <section className="card grid gap-4 p-5 sm:grid-cols-3">
          <h2 className="font-bold sm:col-span-3">Genel</h2>
          <Field name="creditPriceTry" label="1 kredinin fiyatı" value={p.creditPriceTry} unit="₺" />
          <Field name="usdTry" label="Dolar kuru" value={p.usdTry} unit="₺" />
          <Field name="higgsfieldCreditUsd" label="Higgsfield plan kredisi" value={p.higgsfieldCreditUsd} unit="$" />
        </section>

        <section className="card grid gap-4 p-5 sm:grid-cols-3">
          <h2 className="font-bold sm:col-span-3">Sipariş kredisi (video başına)</h2>
          {(Object.keys(p.credits) as (keyof typeof p.credits)[]).map((id) => (
            <Field key={id} name={`credits.${id}`} label={n(id)} value={p.credits[id]} unit="kredi" />
          ))}
          <p className="text-sm text-mute sm:col-span-3">
            {n("sunucu-ev")}: sahne başına {TOUR_QUALITY.orta.credits} (orta) / {TOUR_QUALITY.yuksek.credits} (yüksek) kredi; kodda sabit (packages/shared/src/templates.ts).
          </p>
        </section>

        <section className="card grid gap-4 p-5 sm:grid-cols-3">
          <h2 className="font-bold sm:col-span-3">Tahmini maliyet</h2>
          <Field name="costUsd.arsa-drone" label={n("arsa-drone")} value={c["arsa-drone"]} unit="$" />
          <Field name="costUsd.bitmis-hali" label={n("bitmis-hali")} value={c["bitmis-hali"]} unit="$" />
          <Field name="costUsd.insaat-videosu" label={n("insaat-videosu")} value={c["insaat-videosu"]} unit="$" />
          <Field name="costUsd.ilan-videosu.perPhoto" label={`${n("ilan-videosu")} · fotoğraf başına`} value={c["ilan-videosu"].perPhoto} unit="$" />
          <Field name="costUsd.dosenmis-ev.base" label={`${n("dosenmis-ev")} · sabit`} value={c["dosenmis-ev"].base} unit="$" />
          <Field name="costUsd.dosenmis-ev.perRoom" label={`${n("dosenmis-ev")} · oda başına`} value={c["dosenmis-ev"].perRoom} unit="$" />
          <Field name="costUsd.sunucu-ev.higgsfieldPerScene.orta" label={`${n("sunucu-ev")} · orta, sahne başına`} value={c["sunucu-ev"].higgsfieldPerScene.orta} unit="kredi" />
          <Field name="costUsd.sunucu-ev.higgsfieldPerScene.yuksek" label={`${n("sunucu-ev")} · yüksek, sahne başına`} value={c["sunucu-ev"].higgsfieldPerScene.yuksek} unit="kredi" />
          <Field name="costUsd.sunucu-ev.extraUsdPerScene" label={`${n("sunucu-ev")} · ek maliyet, sahne başına`} value={c["sunucu-ev"].extraUsdPerScene} unit="$" />
        </section>
        <button className="btn-primary">Kaydet</button>
      </form>
    </>
  );
}
