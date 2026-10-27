import { and, desc, eq, getDb, user, videos } from "@arsa/db";
import { TEMPLATE_IDS, TEMPLATES, type ReelStatus, type TemplateId } from "@arsa/shared";
import Link from "next/link";
import { Filters, PageTitle, StatusBadge, Table } from "@/components/admin/ui";
import { overallProgress, videoTitle } from "@/components/status";
import { adminVideoColumns, videoCost } from "@/lib/admin";
import { getPricing } from "@/lib/credits";
import { formatDate, formatTry } from "@/lib/format";
import { requireAdmin } from "@/lib/auth";

const STATUSES: { value: "" | ReelStatus; label: string }[] = [
  { value: "", label: "Tümü" },
  { value: "running", label: "Üretiliyor" },
  { value: "queued", label: "Sırada" },
  { value: "failed", label: "Hata" },
  { value: "done", label: "Hazır" },
];

const dur = (a: Date | null, b: Date | null) => (a && b ? `${Math.round((b.getTime() - a.getTime()) / 60000)} dk` : "—");

export default async function ProductionsPage({ searchParams }: { searchParams: Promise<{ durum?: string; sablon?: string }> }) {
  // Yerleşim de denetler; sayfa yerleşimle paralel çalıştığı için veri sorgusundan önce burada da.
  await requireAdmin();
  const sp = await searchParams;
  const durum = STATUSES.find((s) => s.value === sp.durum)?.value ?? "";
  const sablon = (TEMPLATE_IDS as readonly string[]).includes(sp.sablon ?? "") ? (sp.sablon as TemplateId) : undefined;
  const qs = (o: Record<string, string | undefined>) => {
    const p = new URLSearchParams(Object.entries({ durum, sablon, ...o }).filter(([, v]) => v) as [string, string][]);
    return `/admin/uretimler${p.size ? `?${p}` : ""}`;
  };
  const [rows, pricing] = await Promise.all([
    getDb()
      .select({ ...adminVideoColumns, email: user.email })
      .from(videos)
      .innerJoin(user, eq(user.id, videos.userId))
      .where(and(durum ? eq(videos.status, durum) : undefined, sablon ? eq(videos.template, sablon) : undefined))
      .orderBy(desc(videos.createdAt))
      .limit(300),
    getPricing(),
  ]);
  return (
    <>
      <PageTitle sub={`son ${rows.length} kayıt`}>Üretimler</PageTitle>
      <div className="mb-4 flex flex-col items-start gap-2">
        <Filters current={durum} items={STATUSES.map((s) => ({ ...s, href: qs({ durum: s.value }) }))} />
        <Filters
          current={sablon ?? ""}
          items={[{ value: "", label: "Bütün şablonlar" }, ...TEMPLATE_IDS.map((id) => ({ value: id, label: TEMPLATES[id].name }))].map((s) => ({ ...s, href: qs({ sablon: s.value }) }))}
        />
      </div>
      <Table head={["Video", "Kullanıcı", "Durum", "Tarih", "Süre", "Kredi", "Maliyet"]} empty={!rows.length}>
        {rows.map((v) => (
          <tr key={v.id}>
            <td className="px-4 py-3">
              <Link href={`/admin/uretimler/${v.id}`} className="font-bold hover:text-gok">{videoTitle(v)}</Link>
              <div className="text-xs text-gri">{TEMPLATES[v.template]?.name}</div>
            </td>
            <td className="px-4 py-3">
              <Link href={`/admin/kullanicilar/${v.userId}`} className="text-gri hover:text-gok">{v.email}</Link>
            </td>
            <td className="px-4 py-3">
              <StatusBadge status={v.status} />
              {v.status === "running" ? <div className="mt-1 text-xs text-gri tabular-nums">%{Math.round(overallProgress(v.status, v.stage, v.progress, v.template) * 100)}</div> : null}
              {v.status === "failed" && v.error ? <div className="mt-1 max-w-56 truncate text-xs text-mercan-koyu" title={v.error}>{v.error}</div> : null}
            </td>
            <td className="px-4 py-3 text-gri">{formatDate(v.createdAt)}</td>
            <td className="px-4 py-3 text-gri tabular-nums">{dur(v.startedAt, v.finishedAt)}</td>
            <td className="px-4 py-3 tabular-nums">{v.credits}</td>
            <td className="px-4 py-3 tabular-nums">
              {formatTry(videoCost(v, pricing))}
              {v.costTry == null ? <span className="ml-1.5 text-xs text-gri">tahmin</span> : null}
            </td>
          </tr>
        ))}
      </Table>
    </>
  );
}
