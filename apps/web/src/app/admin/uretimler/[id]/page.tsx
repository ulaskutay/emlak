import { and, eq, getDb, creditLedger, user, videos } from "@arsa/db";
import { TEMPLATES, estimateCostTry } from "@arsa/shared";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cancelVideo, refundVideo, retryVideo, setVideoCost } from "@/app/admin/actions";
import { ConfirmButton } from "@/components/admin/Confirm";
import { PageTitle, Stat, StatusBadge } from "@/components/admin/ui";
import { overallProgress, statusLabel, videoTitle } from "@/components/status";
import { getPricing } from "@/lib/credits";
import { formatDate, formatTry } from "@/lib/format";
import { r2 } from "@/lib/r2";

export default async function ProductionDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const [row] = await db.select({ v: videos, email: user.email }).from(videos).innerJoin(user, eq(user.id, videos.userId)).where(eq(videos.id, id));
  if (!row) notFound();
  const { v, email } = row;
  const [pricing, refunds] = await Promise.all([
    getPricing(),
    db.select({ delta: creditLedger.delta }).from(creditLedger).where(and(eq(creditLedger.videoId, id), eq(creditLedger.reason, "refund"))),
  ]);
  const estimate = estimateCostTry(v.template, v.input, pricing);
  const play = v.status === "done" && v.reelKey ? await r2().url(v.reelKey, 3600).catch(() => null) : null;
  const poster = v.keyframeKey ? await r2().url(v.keyframeKey, 3600).catch(() => null) : null;
  const active = v.status === "queued" || v.status === "running";
  const { parcelText: _omit, ...raw } = v;

  return (
    <>
      <Link href="/admin/uretimler" className="text-sm text-mute hover:text-white">← Üretimler</Link>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
        <PageTitle
          sub={
            <>
              {TEMPLATES[v.template]?.name} · <Link href={`/admin/kullanicilar/${v.userId}`} className="hover:text-white">{email}</Link> · {formatDate(v.createdAt)}
            </>
          }
        >
          {videoTitle(v)}
        </PageTitle>
        <div className="flex flex-wrap gap-2">
          {active ? (
            <form action={cancelVideo}>
              <input type="hidden" name="id" value={v.id} />
              <ConfirmButton className="btn border border-red-500/40 text-red-300 hover:bg-red-500/10" message="Üretim iptal edilsin mi? Süren iş durdurulamaz, ama sonucu kaydedilmez.">
                İptal et
              </ConfirmButton>
            </form>
          ) : null}
          {v.status === "failed" || v.status === "done" ? (
            <form action={retryVideo}>
              <input type="hidden" name="id" value={v.id} />
              <ConfirmButton className="btn-ghost" message="Video baştan yeniden üretilsin mi? Kredi yeniden düşülmez, maliyet yeniden oluşur.">
                Yeniden üret
              </ConfirmButton>
            </form>
          ) : null}
          {v.credits && !refunds.length ? (
            <form action={refundVideo}>
              <input type="hidden" name="id" value={v.id} />
              <ConfirmButton className="btn-ghost" message={`${v.credits} kredi kullanıcıya iade edilsin mi?`}>
                {v.credits} krediyi iade et
              </ConfirmButton>
            </form>
          ) : refunds.length ? (
            <span className="btn border border-line text-mute">Kredi iade edildi</span>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Durum"
          value={<StatusBadge status={v.status} />}
          hint={v.status === "running" ? `${statusLabel(v.status, v.stage, v.template)} · %${Math.round(overallProgress(v.status, v.stage, v.progress, v.template) * 100)}` : `${v.attempts} deneme`}
        />
        <Stat label="Kredi" value={v.credits} />
        <Stat label="Maliyet" value={formatTry(v.costTry ?? estimate)} hint={v.costTry != null ? `tahmin ${formatTry(estimate)}` : "tahmin"} />
        <Stat label="Video süresi" value={v.durationSec ? `${v.durationSec.toFixed(1)} sn` : "—"} hint={v.startedAt && v.finishedAt ? `üretim ${Math.round((v.finishedAt.getTime() - v.startedAt.getTime()) / 60000)} dk` : undefined} />
      </div>

      {v.error ? <pre className="card mt-4 whitespace-pre-wrap border-red-500/30 p-4 text-sm text-red-300">{v.error}</pre> : null}

      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,20rem)_1fr]">
        <div className="space-y-4">
          {play ? (
            <video src={play} poster={poster ?? undefined} controls playsInline className="aspect-[9/16] w-full rounded-2xl border border-line bg-black" />
          ) : poster ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={poster} alt="" className="w-full rounded-2xl border border-line" />
          ) : (
            <div className="card flex aspect-[9/16] items-center justify-center text-sm text-mute">Video yok</div>
          )}
          <form action={setVideoCost} className="card space-y-3 p-4">
            <input type="hidden" name="id" value={v.id} />
            <label className="label" htmlFor="costTry">Gerçek maliyet (₺)</label>
            <input id="costTry" name="costTry" inputMode="decimal" defaultValue={v.costTry ?? ""} placeholder={`boş = tahmin (${formatTry(estimate)})`} className="input" />
            <button className="btn-ghost w-full">Maliyeti kaydet</button>
          </form>
        </div>
        <section className="card min-w-0 p-4">
          <h2 className="mb-2 font-bold">Sipariş ve üretim ayrıntısı</h2>
          <pre className="max-h-[36rem] overflow-auto text-xs leading-relaxed text-mute">{JSON.stringify(raw, null, 2)}</pre>
        </section>
      </div>
    </>
  );
}
