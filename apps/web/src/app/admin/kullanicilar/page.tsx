import Link from "next/link";
import { PageTitle, Pill, Table } from "@/components/admin/ui";
import { userList } from "@/lib/admin";
import { isAdmin, requireAdmin } from "@/lib/auth";
import { formatDate, formatInt, formatTry } from "@/lib/format";

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  // Yerleşim de denetler; sayfa yerleşimle paralel çalıştığı için veri sorgusundan önce burada da.
  await requireAdmin();
  const q = (await searchParams).q ?? "";
  const rows = await userList(q);
  return (
    <>
      <PageTitle sub={`${formatInt(rows.length)} kullanıcı${q ? ` · “${q}” araması` : ""}`}>Kullanıcılar</PageTitle>
      <form className="mb-4 flex max-w-md gap-2">
        <input name="q" type="search" defaultValue={q} placeholder="E-posta ya da ad ara" aria-label="Kullanıcı ara" className="adm-input" />
        <button className="adm-btn-ghost">Ara</button>
      </form>
      <Table head={["Kullanıcı", "Kayıt", "Video", "Son video", "Ödeme", "Bakiye", ""]} empty={!rows.length}>
        {rows.map((u) => (
          <tr key={u.id}>
            <td className="px-4 py-3">
              <Link href={`/admin/kullanicilar/${u.id}`} className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gok-acik text-sm font-extrabold uppercase text-gok-koyu">{(u.name || u.email).slice(0, 1)}</span>
                <span className="min-w-0">
                  <span className="block font-bold hover:text-gok">{u.name || "—"}</span>
                  <span className="block text-xs text-gri">{u.email}</span>
                </span>
              </Link>
            </td>
            <td className="px-4 py-3 text-gri">{formatDate(u.createdAt)}</td>
            <td className="px-4 py-3 tabular-nums">{formatInt(u.videos)}</td>
            <td className="px-4 py-3 text-gri">{u.lastVideo ? formatDate(u.lastVideo) : "—"}</td>
            <td className="px-4 py-3 tabular-nums">{u.paid ? formatTry(Number(u.paid)) : "—"}</td>
            <td className={`px-4 py-3 font-semibold tabular-nums ${u.balance < 0 ? "text-mercan-koyu" : ""}`}>{formatInt(u.balance)}</td>
            <td className="space-x-1 px-4 py-3 text-right">
              {isAdmin(u) ? <Pill>Yönetici</Pill> : null}
              {u.banned ? <Pill tone="mercan">Engelli</Pill> : null}
            </td>
          </tr>
        ))}
      </Table>
    </>
  );
}
