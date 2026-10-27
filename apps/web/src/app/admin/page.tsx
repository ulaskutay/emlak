import { TEMPLATES } from "@arsa/shared";
import Link from "next/link";
import { DailyBars, Filters, PageTitle, SectionTitle, Stat, Table } from "@/components/admin/ui";
import { overview } from "@/lib/admin";
import { creditsEnforced } from "@/lib/credits";
import { formatInt, formatTry } from "@/lib/format";
import { requireAdmin } from "@/lib/auth";

const PERIODS = [
  { value: "7", label: "7 gün" },
  { value: "30", label: "30 gün" },
  { value: "90", label: "90 gün" },
  { value: "0", label: "Tümü" },
];

export default async function AdminHome({ searchParams }: { searchParams: Promise<{ gun?: string }> }) {
  // Yerleşim de denetler; sayfa yerleşimle paralel çalıştığı için veri sorgusundan önce burada da.
  await requireAdmin();
  const gun = (await searchParams).gun ?? "30";
  const days = PERIODS.some((p) => p.value === gun) ? Number(gun) : 30;
  const o = await overview(days);
  const margin = o.revenue ? Math.round((o.profit / o.revenue) * 100) : null;
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageTitle
          sub={
            <span className="inline-flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${creditsEnforced() ? "bg-cimen" : "bg-gunes"}`} />
              {creditsEnforced() ? "Kredi kontrolü açık: bakiyesi yetmeyen sipariş veremez." : "Kredi kontrolü kapalı: sipariş bakiyeye bakmadan alınır (CREDITS_ENFORCED=1 ile açılır)."}
            </span>
          }
        >
          Özet
        </PageTitle>
        <div className="mb-7">
          <Filters current={String(days)} items={PERIODS.map((p) => ({ ...p, href: `/admin?gun=${p.value}` }))} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Kayıtlı kullanıcı" value={formatInt(o.users.total)} hint={`dönemde +${formatInt(o.users.inPeriod)}`} />
        <Stat label="Gelir" value={formatTry(o.revenue)} hint={`${o.payingUsers} ödeme yapan kullanıcı`} />
        <Stat label="Maliyet" value={formatTry(o.cost)} hint="girilen gerçek değer, yoksa tahmin" />
        <Stat label="Kâr" value={formatTry(o.profit)} hint={margin != null ? `marj %${margin}` : "gelir yok"} tone={o.profit >= 0 ? "good" : "bad"} featured />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Üretim (dönem)" value={formatInt(o.videos.total)} hint={`${o.videos.done} hazır · ${o.videos.failed} hata`} />
        <Stat
          label="Şu an kuyrukta"
          value={formatInt((o.queueNow.queued ?? 0) + (o.queueNow.running ?? 0))}
          hint={<Link href="/admin/uretimler?durum=running" className="hover:text-gok">{o.queueNow.running ?? 0} üretiliyor · {o.queueNow.queued ?? 0} sırada</Link>}
        />
        <Stat label="Başarı oranı" value={o.videos.done + o.videos.failed ? `%${Math.round((o.videos.done / (o.videos.done + o.videos.failed)) * 100)}` : "—"} hint="biten üretimler içinde" />
        <Stat
          label="Kredi (dönem)"
          value={`${formatInt(o.credits.spent)} harcandı`}
          hint={`${formatInt(o.credits.purchased)} satın alındı · ${formatInt(o.credits.granted)} elle · ${formatInt(o.credits.refunded)} iade`}
        />
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <DailyBars title="Yeni kayıt" data={o.daily.map((d) => ({ day: d.day, value: d.signups }))} format={formatInt} />
        <DailyBars title="Üretim" data={o.daily.map((d) => ({ day: d.day, value: d.videos }))} format={formatInt} />
        <DailyBars title="Gelir" data={o.daily.map((d) => ({ day: d.day, value: d.revenue }))} format={formatTry} />
      </div>

      <SectionTitle>Şablonlara göre</SectionTitle>
      <Table head={["Şablon", "Üretim", "Hazır", "Kredi", "Maliyet", "Ortalama maliyet"]} empty={!o.byTemplate.length}>
        {o.byTemplate.map(([id, t]) => (
          <tr key={id}>
            <td className="px-4 py-3 font-bold">
              <Link href={`/admin/uretimler?sablon=${id}`} className="hover:text-gok">{TEMPLATES[id]?.name ?? id}</Link>
            </td>
            <td className="px-4 py-3 tabular-nums">{formatInt(t.n)}</td>
            <td className="px-4 py-3 tabular-nums">{formatInt(t.done)}</td>
            <td className="px-4 py-3 tabular-nums">{formatInt(t.credits)}</td>
            <td className="px-4 py-3 tabular-nums">{formatTry(t.cost)}</td>
            <td className="px-4 py-3 tabular-nums">{formatTry(t.n ? t.cost / t.n : 0)}</td>
          </tr>
        ))}
      </Table>
    </>
  );
}
