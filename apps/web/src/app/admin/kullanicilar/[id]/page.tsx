import { creditLedger, desc, eq, getDb, payments, user, videos } from "@arsa/db";
import { TEMPLATES } from "@arsa/shared";
import Link from "next/link";
import { notFound } from "next/navigation";
import { grantCredits, recordPayment, setUserFlags } from "@/app/admin/actions";
import { ConfirmButton } from "@/components/admin/Confirm";
import { PageTitle, Stat, StatusBadge, Table } from "@/components/admin/ui";
import { videoTitle } from "@/components/status";
import { adminVideoColumns, videoCost } from "@/lib/admin";
import { isAdmin, requireAdmin } from "@/lib/auth";
import { creditBalance, getPricing } from "@/lib/credits";
import { formatDate, formatInt, formatTry } from "@/lib/format";

const REASON: Record<string, string> = { admin: "Elle", purchase: "Satın alma", video: "Video", refund: "İade" };
const METHOD: Record<string, string> = { havale: "Havale/EFT", kart: "Kart", nakit: "Nakit", diger: "Diğer" };

export default async function UserDetail({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireAdmin();
  const { id } = await params;
  const db = getDb();
  const [u] = await db.select().from(user).where(eq(user.id, id));
  if (!u) notFound();
  const [balance, vids, ledger, pays, pricing] = await Promise.all([
    creditBalance(id),
    db.select(adminVideoColumns).from(videos).where(eq(videos.userId, id)).orderBy(desc(videos.createdAt)).limit(100),
    db.select().from(creditLedger).where(eq(creditLedger.userId, id)).orderBy(desc(creditLedger.createdAt)).limit(100),
    db.select().from(payments).where(eq(payments.userId, id)).orderBy(desc(payments.createdAt)),
    getPricing(),
  ]);
  const paid = pays.filter((p) => p.status === "paid").reduce((a, p) => a + p.amountTry, 0);
  const cost = vids.reduce((a, v) => a + videoCost(v, pricing), 0);
  const self = u.id === me.id;

  return (
    <>
      <Link href="/admin/kullanicilar" className="text-sm text-mute hover:text-white">← Kullanıcılar</Link>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
        <PageTitle sub={`${u.email} · kayıt ${formatDate(u.createdAt)}`}>{u.name || u.email}</PageTitle>
        {self ? null : (
          <div className="flex flex-wrap gap-2">
            <form action={setUserFlags}>
              <input type="hidden" name="userId" value={u.id} />
              <input type="hidden" name="field" value="role" />
              <input type="hidden" name="value" value={u.role === "admin" ? "user" : "admin"} />
              <ConfirmButton className="btn-ghost" message={u.role === "admin" ? "Yönetici yetkisi kaldırılsın mı?" : "Bu kullanıcı yönetici yapılsın mı? Bütün verilere erişir."}>
                {u.role === "admin" ? "Yöneticiliği kaldır" : "Yönetici yap"}
              </ConfirmButton>
            </form>
            <form action={setUserFlags}>
              <input type="hidden" name="userId" value={u.id} />
              <input type="hidden" name="field" value="banned" />
              <input type="hidden" name="value" value={u.banned ? "0" : "1"} />
              <ConfirmButton className={u.banned ? "btn-ghost" : "btn border border-red-500/40 text-red-300 hover:bg-red-500/10"} message={u.banned ? "Engel kaldırılsın mı?" : "Kullanıcı engellensin mi? Oturumları kapanır, panele giremez."}>
                {u.banned ? "Engeli kaldır" : "Engelle"}
              </ConfirmButton>
            </form>
          </div>
        )}
      </div>
      {isAdmin(u) || u.banned ? (
        <p className="-mt-3 mb-5 text-sm">
          {isAdmin(u) ? <span className="text-neon">Yönetici{u.role !== "admin" ? " (ADMIN_EMAILS)" : ""}</span> : null}
          {u.banned ? <span className="ml-2 text-red-300">Engelli</span> : null}
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Kredi bakiyesi" value={formatInt(balance)} tone={balance < 0 ? "bad" : undefined} />
        <Stat label="Video" value={formatInt(vids.length)} hint={`${vids.filter((v) => v.status === "done").length} hazır`} />
        <Stat label="Ödeme" value={formatTry(paid)} hint={`${pays.length} kayıt`} />
        <Stat label="Maliyet" value={formatTry(cost)} hint={`kâr ${formatTry(paid - cost)}`} tone={paid - cost >= 0 ? "good" : "bad"} />
      </div>

      <div className="mt-6 grid gap-3 lg:grid-cols-2">
        <form action={grantCredits} className="card space-y-3 p-5">
          <h2 className="font-bold">Kredi ekle / düş</h2>
          <input type="hidden" name="userId" value={u.id} />
          <div className="grid grid-cols-[8rem_1fr] gap-3">
            <div>
              <label className="label" htmlFor="delta">Kredi</label>
              <input id="delta" name="delta" type="number" step="1" required placeholder="10 ya da -5" className="input" />
            </div>
            <div>
              <label className="label" htmlFor="note">Not</label>
              <input id="note" name="note" placeholder="Ör. deneme hediyesi, hatalı video telafisi" className="input" />
            </div>
          </div>
          <button className="btn-primary">Kaydet</button>
        </form>

        <form action={recordPayment} className="card space-y-3 p-5">
          <h2 className="font-bold">Ödeme kaydet</h2>
          <input type="hidden" name="userId" value={u.id} />
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label" htmlFor="amountTry">Tutar (₺)</label>
              <input id="amountTry" name="amountTry" inputMode="decimal" required className="input" />
            </div>
            <div>
              <label className="label" htmlFor="credits">Verilecek kredi</label>
              <input id="credits" name="credits" type="number" step="1" min="0" defaultValue={0} className="input" />
            </div>
            <div>
              <label className="label" htmlFor="method">Yöntem</label>
              <select id="method" name="method" className="input">
                {Object.entries(METHOD).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input name="reference" placeholder="Dekont / işlem no" className="input" />
            <input name="note" placeholder="Not" className="input" />
          </div>
          <button className="btn-primary">Ödemeyi kaydet</button>
        </form>
      </div>

      <h2 className="mb-3 mt-8 text-lg font-bold">Videolar</h2>
      <Table head={["Video", "Durum", "Tarih", "Kredi", "Maliyet"]} empty={!vids.length}>
        {vids.map((v) => (
          <tr key={v.id}>
            <td className="px-4 py-3">
              <Link href={`/admin/uretimler/${v.id}`} className="font-semibold hover:text-neon">{videoTitle(v)}</Link>
              <div className="text-xs text-mute">{TEMPLATES[v.template]?.name}</div>
            </td>
            <td className="px-4 py-3"><StatusBadge status={v.status} /></td>
            <td className="px-4 py-3 text-mute">{formatDate(v.createdAt)}</td>
            <td className="px-4 py-3 tabular-nums">{v.credits}</td>
            <td className="px-4 py-3 tabular-nums">{formatTry(videoCost(v, pricing))}</td>
          </tr>
        ))}
      </Table>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 text-lg font-bold">Kredi hareketleri</h2>
          <Table head={["Tarih", "Tür", "Kredi", "Not"]} empty={!ledger.length}>
            {ledger.map((l) => (
              <tr key={l.id}>
                <td className="px-4 py-3 text-mute">{formatDate(l.createdAt)}</td>
                <td className="px-4 py-3">
                  {l.videoId ? <Link href={`/admin/uretimler/${l.videoId}`} className="hover:text-neon">{REASON[l.reason]}</Link> : REASON[l.reason]}
                </td>
                <td className={`px-4 py-3 font-semibold tabular-nums ${l.delta < 0 ? "text-red-300" : "text-emerald-300"}`}>{l.delta > 0 ? `+${l.delta}` : l.delta}</td>
                <td className="px-4 py-3 text-mute">{l.note ?? ""}</td>
              </tr>
            ))}
          </Table>
        </section>
        <section>
          <h2 className="mb-3 text-lg font-bold">Ödemeler</h2>
          <Table head={["Tarih", "Tutar", "Kredi", "Yöntem", "Durum"]} empty={!pays.length}>
            {pays.map((p) => (
              <tr key={p.id}>
                <td className="px-4 py-3 text-mute">{formatDate(p.createdAt)}</td>
                <td className="px-4 py-3 font-semibold tabular-nums">{formatTry(p.amountTry)}</td>
                <td className="px-4 py-3 tabular-nums">{p.credits}</td>
                <td className="px-4 py-3">{METHOD[p.method]}</td>
                <td className="px-4 py-3"><Link href="/admin/odemeler" className="hover:text-neon">{p.status === "paid" ? "Ödendi" : p.status === "pending" ? "Bekliyor" : "İade"}</Link></td>
              </tr>
            ))}
          </Table>
        </section>
      </div>
    </>
  );
}
