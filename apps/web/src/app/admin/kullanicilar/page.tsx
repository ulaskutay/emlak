import Link from "next/link";
import { PageTitle, Table } from "@/components/admin/ui";
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
        <input name="q" defaultValue={q} placeholder="E-posta ya da ad ara" className="input" />
        <button className="btn-ghost">Ara</button>
      </form>
      <Table head={["Kullanıcı", "Kayıt", "Video", "Son video", "Ödeme", "Bakiye", ""]} empty={!rows.length}>
        {rows.map((u) => (
          <tr key={u.id} className="hover:bg-white/[0.02]">
            <td className="px-4 py-3">
              <Link href={`/admin/kullanicilar/${u.id}`} className="font-semibold hover:text-neon">{u.name || "—"}</Link>
              <div className="text-xs text-mute">{u.email}</div>
            </td>
            <td className="px-4 py-3 text-mute">{formatDate(u.createdAt)}</td>
            <td className="px-4 py-3 tabular-nums">{formatInt(u.videos)}</td>
            <td className="px-4 py-3 text-mute">{u.lastVideo ? formatDate(u.lastVideo) : "—"}</td>
            <td className="px-4 py-3 tabular-nums">{u.paid ? formatTry(Number(u.paid)) : "—"}</td>
            <td className={`px-4 py-3 font-semibold tabular-nums ${u.balance < 0 ? "text-red-300" : ""}`}>{formatInt(u.balance)}</td>
            <td className="px-4 py-3 text-right">
              {isAdmin(u) ? <span className="rounded-md bg-neon/15 px-2 py-0.5 text-xs font-semibold text-neon">Yönetici</span> : null}
              {u.banned ? <span className="ml-1 rounded-md bg-red-500/15 px-2 py-0.5 text-xs font-semibold text-red-300">Engelli</span> : null}
            </td>
          </tr>
        ))}
      </Table>
    </>
  );
}
