import { desc, eq, getDb, payments, user } from "@arsa/db";
import Link from "next/link";
import { setPaymentStatus } from "@/app/admin/actions";
import { PageTitle, Stat, Table } from "@/components/admin/ui";
import { formatDate, formatInt, formatTry } from "@/lib/format";
import { requireAdmin } from "@/lib/auth";

const METHOD: Record<string, string> = { havale: "Havale/EFT", kart: "Kart", nakit: "Nakit", diger: "Diğer" };
const STATUS: Record<string, string> = { paid: "Ödendi", pending: "Bekliyor", refunded: "İade edildi" };

export default async function PaymentsPage() {
  // Yerleşim de denetler; sayfa yerleşimle paralel çalıştığı için veri sorgusundan önce burada da.
  await requireAdmin();
  const rows = await getDb()
    .select({ p: payments, email: user.email })
    .from(payments)
    .innerJoin(user, eq(user.id, payments.userId))
    .orderBy(desc(payments.createdAt))
    .limit(500);
  const sumOf = (s: string) => rows.filter((r) => r.p.status === s).reduce((a, r) => a + r.p.amountTry, 0);
  const month = new Date(Date.now() - 30 * 86_400_000);
  return (
    <>
      <PageTitle sub="Ödeme altyapısı bağlanana kadar ödemeler kullanıcı sayfasından elle girilir.">Ödemeler</PageTitle>
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Toplam tahsilat" value={formatTry(sumOf("paid"))} hint={`${rows.filter((r) => r.p.status === "paid").length} ödeme`} />
        <Stat label="Son 30 gün" value={formatTry(rows.filter((r) => r.p.status === "paid" && r.p.createdAt >= month).reduce((a, r) => a + r.p.amountTry, 0))} />
        <Stat label="Bekleyen" value={formatTry(sumOf("pending"))} />
        <Stat label="İade" value={formatTry(sumOf("refunded"))} />
      </div>
      <Table head={["Tarih", "Kullanıcı", "Tutar", "Kredi", "Yöntem", "Dekont / not", "Durum"]} empty={!rows.length}>
        {rows.map(({ p, email }) => (
          <tr key={p.id}>
            <td className="px-4 py-3 text-mute">{formatDate(p.createdAt)}</td>
            <td className="px-4 py-3"><Link href={`/admin/kullanicilar/${p.userId}`} className="hover:text-neon">{email}</Link></td>
            <td className="px-4 py-3 font-semibold tabular-nums">{formatTry(p.amountTry)}</td>
            <td className="px-4 py-3 tabular-nums">{formatInt(p.credits)}</td>
            <td className="px-4 py-3">{METHOD[p.method]}</td>
            <td className="px-4 py-3 text-mute">{[p.reference, p.note].filter(Boolean).join(" · ")}</td>
            <td className="px-4 py-3">
              <form action={setPaymentStatus} className="flex gap-2">
                <input type="hidden" name="id" value={p.id} />
                <select name="status" defaultValue={p.status} className="input py-1.5">
                  {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <button className="btn-ghost py-1.5">Kaydet</button>
              </form>
            </td>
          </tr>
        ))}
      </Table>
      <p className="mt-3 text-xs text-mute">Ödendi’den çıkan ödemenin kredisi kullanıcıdan düşülür, Ödendi’ye geçende verilir.</p>
    </>
  );
}
