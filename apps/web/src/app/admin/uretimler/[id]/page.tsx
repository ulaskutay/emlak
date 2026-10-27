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
import { requireAdmin } from "@/lib/auth";

export default async function ProductionDetail({ params }: { params: Promise<{ id: string }> }) {
  // Yerleşim de denetler; sayfa yerleşimle paralel çalıştığı için veri sorgusundan önce burada da.
  await requireAdmin();
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
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageTitle
          back={{ href: "/admin/uretimler", label: "Üretimler" }}
          sub={
            <>
              {TEMPLATES[v.template]?.name} · <Link href={`/admin/kullanicilar/${v.userId}`} className="hover:text-gok">{email}</Link> · {formatDate(v.createdAt)}
            </>
          }
        >
          {videoTitle(v)}
        </PageTitle>
        <div className="mb-7 flex flex-wrap gap-2">
          {active ? (
            <form action={cancelVideo}>
              <input type="hidden" name="id" value={v.id} />
              <ConfirmButton className="adm-btn-danger" message="Üretim iptal edilsin mi? Süren iş durdurulamaz, ama sonucu kaydedilmez.">
                İptal et
              </ConfirmButton>
            </form>
          ) : null}
          {v.status === "failed" || v.status === "done" ? (
            <form action={retryVideo}>
              <input type="hidden" name="id" value={v.id} />
              <ConfirmButton className="adm-btn-ghost" message="Video baştan yeniden üretilsin mi? Kredi yeniden düşülmez, maliyet yeniden oluşur.">
                Yeniden üret
              </ConfirmButton>
            </form>
          ) : null}
          {v.credits && !refunds.length ? (
            <form action={refundVideo}>
              <input type="hidden" name="id" value={v.id} />
              <ConfirmButton className="adm-btn-ghost" message={`${v.credits} kredi kullanıcıya iade edilsin mi?`}>
                {v.credits} krediyi iade et
              </ConfirmButton>
            </form>
          ) : refunds.length ? (
            <span className="adm-btn border border-ayrac bg-zemin text-gri">Kredi iade edildi</span>
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

      {v.error ? <pre className="mt-3 whitespace-pre-wrap rounded-2xl border border-mercan/30 bg-mercan-acik/60 p-4 text-sm text-mercan-koyu">{v.error}</pre> : null}

      <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,20rem)_1fr]">
        <div className="space-y-4">
          {play ? (
            <video src={play} poster={poster ?? undefined} controls playsInline className="aspect-[9/16] w-full rounded-2xl bg-lacivert shadow-[0_16px_32px_-20px_rgba(13,27,62,.8)]" />
          ) : poster ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={poster} alt="" className="w-full rounded-2xl border border-ayrac" />
          ) : (
            <div className="adm-kart flex aspect-[9/16] items-center justify-center text-sm text-gri">Video yok</div>
          )}
          <form action={setVideoCost} className="adm-kart space-y-3 p-5">
            <input type="hidden" name="id" value={v.id} />
            <label className="adm-label" htmlFor="costTry">Gerçek maliyet (₺)</label>
            <input id="costTry" name="costTry" inputMode="decimal" defaultValue={v.costTry ?? ""} placeholder={`boş = tahmin (${formatTry(estimate)})`} className="adm-input" />
            <button className="adm-btn-ghost w-full">Maliyeti kaydet</button>
          </form>
        </div>
        <section className="adm-kart min-w-0 p-5">
          <h2 className="mb-3 font-extrabold">Sipariş ve üretim ayrıntısı</h2>
          <pre className="max-h-[36rem] overflow-auto rounded-xl bg-zemin p-4 font-mono text-xs leading-relaxed text-gri">{JSON.stringify(raw, null, 2)}</pre>
        </section>
      </div>
    </>
  );
}
