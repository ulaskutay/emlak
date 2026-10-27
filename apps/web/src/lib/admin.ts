import "server-only";
import { creditLedger, desc, eq, getDb, gte, payments, sql, user, videos } from "@arsa/db";
import { estimateCostTry, type PricingSettings, type TemplateId, type TemplateInput } from "@arsa/shared";
import { getPricing } from "./credits";

/** Videonun maliyeti (TL): yöneticinin girdiği gerçek değer, yoksa tahmin. Sıradaki videonun maliyeti yok. */
export function videoCost(v: { template: TemplateId; input: TemplateInput; status: string; costTry: number | null }, p: PricingSettings) {
  if (v.costTry != null) return v.costTry;
  return v.status === "done" || v.status === "failed" || v.status === "running" ? estimateCostTry(v.template, v.input, p) : 0;
}

const dayKey = (d: Date) => d.toLocaleDateString("sv-SE", { timeZone: "Europe/Istanbul" });

/** Özet sayfası: dönem (gün; 0 = tümü) içindeki kayıt, üretim, gelir, maliyet. */
export async function overview(days: number) {
  const db = getDb();
  const p = await getPricing();
  const since = days ? new Date(Date.now() - days * 86_400_000) : new Date(0);

  const [users, vids, pays, ledger, queue] = await Promise.all([
    db.select({ createdAt: user.createdAt }).from(user),
    db
      .select({ template: videos.template, input: videos.input, status: videos.status, costTry: videos.costTry, credits: videos.credits, createdAt: videos.createdAt })
      .from(videos)
      .where(gte(videos.createdAt, since)),
    db.select({ userId: payments.userId, amountTry: payments.amountTry, status: payments.status, createdAt: payments.createdAt }).from(payments).where(gte(payments.createdAt, since)),
    db
      .select({ reason: creditLedger.reason, total: sql<number>`sum(${creditLedger.delta})::int` })
      .from(creditLedger)
      .where(gte(creditLedger.createdAt, since))
      .groupBy(creditLedger.reason),
    db.select({ status: videos.status, n: sql<number>`count(*)::int` }).from(videos).groupBy(videos.status),
  ]);

  const paid = pays.filter((x) => x.status === "paid");
  const revenue = paid.reduce((a, x) => a + x.amountTry, 0);
  const cost = vids.reduce((a, v) => a + videoCost(v, p), 0);

  const byStatus = { queued: 0, running: 0, done: 0, failed: 0 };
  for (const v of vids) byStatus[v.status]++;
  const byTemplate = new Map<TemplateId, { n: number; done: number; cost: number; credits: number }>();
  for (const v of vids) {
    const t = byTemplate.get(v.template) ?? { n: 0, done: 0, cost: 0, credits: 0 };
    t.n++;
    if (v.status === "done") t.done++;
    t.cost += videoCost(v, p);
    t.credits += v.credits;
    byTemplate.set(v.template, t);
  }

  // Günlük seri: dönem 90 günden uzunsa son 90 gün.
  const span = days && days <= 90 ? days : 90;
  const daily = Array.from({ length: span }, (_, i) => {
    const d = new Date(Date.now() - (span - 1 - i) * 86_400_000);
    return { day: dayKey(d), signups: 0, videos: 0, revenue: 0 };
  });
  const idx = new Map(daily.map((d, i) => [d.day, i]));
  for (const u of users) {
    const i = idx.get(dayKey(u.createdAt));
    if (i != null) daily[i]!.signups++;
  }
  for (const v of vids) {
    const i = idx.get(dayKey(v.createdAt));
    if (i != null) daily[i]!.videos++;
  }
  for (const x of paid) {
    const i = idx.get(dayKey(x.createdAt));
    if (i != null) daily[i]!.revenue += x.amountTry;
  }

  const credit = Object.fromEntries(ledger.map((l) => [l.reason, l.total])) as Partial<Record<string, number>>;
  return {
    users: { total: users.length, inPeriod: users.filter((u) => u.createdAt >= since).length },
    videos: { total: vids.length, ...byStatus },
    queueNow: Object.fromEntries(queue.map((q) => [q.status, q.n])) as Partial<Record<string, number>>,
    revenue,
    cost,
    profit: revenue - cost,
    payingUsers: new Set(paid.map((x) => x.userId)).size,
    credits: { purchased: credit.purchase ?? 0, granted: credit.admin ?? 0, spent: -(credit.video ?? 0) || 0, refunded: credit.refund ?? 0 },
    byTemplate: [...byTemplate.entries()].sort((a, b) => b[1].n - a[1].n),
    daily,
  };
}

/** Kullanıcı listesi: bakiye, video sayısı, ödeme toplamı. */
export async function userList(q?: string) {
  const db = getDb();
  const bal = db
    .select({ userId: creditLedger.userId, balance: sql<number>`sum(${creditLedger.delta})::int`.as("balance") })
    .from(creditLedger)
    .groupBy(creditLedger.userId)
    .as("bal");
  const vc = db
    .select({ userId: videos.userId, n: sql<number>`count(*)::int`.as("n"), last: sql<Date>`max(${videos.createdAt})`.as("last") })
    .from(videos)
    .groupBy(videos.userId)
    .as("vc");
  const pc = db
    .select({ userId: payments.userId, paid: sql<number>`sum(${payments.amountTry}) filter (where ${payments.status} = 'paid')`.as("paid") })
    .from(payments)
    .groupBy(payments.userId)
    .as("pc");
  const term = q?.trim();
  return db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      banned: user.banned,
      createdAt: user.createdAt,
      balance: sql<number>`coalesce(${bal.balance}, 0)`,
      videos: sql<number>`coalesce(${vc.n}, 0)`,
      lastVideo: vc.last,
      paid: sql<number>`coalesce(${pc.paid}, 0)`,
    })
    .from(user)
    .leftJoin(bal, eq(bal.userId, user.id))
    .leftJoin(vc, eq(vc.userId, user.id))
    .leftJoin(pc, eq(pc.userId, user.id))
    .where(term ? sql`${user.email} ilike ${"%" + term + "%"} or ${user.name} ilike ${"%" + term + "%"}` : undefined)
    .orderBy(desc(user.createdAt))
    .limit(500);
}

export const adminVideoColumns = {
  id: videos.id,
  userId: videos.userId,
  template: videos.template,
  input: videos.input,
  status: videos.status,
  stage: videos.stage,
  progress: videos.progress,
  parcelSummary: videos.parcelSummary,
  error: videos.error,
  attempts: videos.attempts,
  credits: videos.credits,
  costTry: videos.costTry,
  durationSec: videos.durationSec,
  createdAt: videos.createdAt,
  startedAt: videos.startedAt,
  finishedAt: videos.finishedAt,
};
