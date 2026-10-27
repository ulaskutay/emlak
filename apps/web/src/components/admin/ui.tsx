import type { ReelStatus } from "@arsa/shared";
import Link from "next/link";
import { statusTone } from "@/components/status";

export function PageTitle({ children, sub }: { children: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h1 className="font-display text-3xl font-bold tracking-[-0.025em]">{children}</h1>
      {sub ? <p className="mt-1 text-sm text-mute">{sub}</p> : null}
    </div>
  );
}

export function Stat({ label, value, hint, tone }: { label: string; value: React.ReactNode; hint?: React.ReactNode; tone?: "good" | "bad" }) {
  return (
    <div className="card p-5">
      <div className="text-sm text-mute">{label}</div>
      <div className={`mt-1 font-display text-2xl font-bold tabular-nums ${tone === "good" ? "text-emerald-300" : tone === "bad" ? "text-red-300" : ""}`}>{value}</div>
      {hint ? <div className="mt-1 text-xs text-mute">{hint}</div> : null}
    </div>
  );
}

const STATUS_TEXT: Record<ReelStatus, string> = { queued: "Sırada", running: "Üretiliyor", done: "Hazır", failed: "Hata" };
export function StatusBadge({ status }: { status: ReelStatus }) {
  return <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${statusTone[status]}`}>{STATUS_TEXT[status]}</span>;
}

/** Sekme benzeri filtre bağlantıları (sorgu parametresiyle). */
export function Filters({ items, current }: { items: { label: string; href: string; value: string }[]; current: string }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((i) => (
        <Link
          key={i.value}
          href={i.href}
          className={`rounded-lg border px-3 py-1.5 text-sm ${i.value === current ? "border-neon/60 bg-neon/10 text-neon" : "border-line text-mute hover:text-white"}`}
        >
          {i.label}
        </Link>
      ))}
    </div>
  );
}

export function Table({ head, children, empty }: { head: string[]; children: React.ReactNode; empty?: boolean }) {
  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="border-b border-line text-xs uppercase tracking-wide text-mute">
          <tr>{head.map((h) => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
      {empty ? <p className="p-6 text-center text-sm text-mute">Kayıt yok</p> : null}
    </div>
  );
}

/** Tek serili günlük çubuk grafik; çubuğun üzerine gelince gün ve değer görünür. */
export function DailyBars({ title, data, format }: { title: string; data: { day: string; value: number }[]; format: (n: number) => string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const total = data.reduce((a, d) => a + d.value, 0);
  const label = (day: string) => new Date(day).toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
  return (
    <figure className="card p-5">
      <figcaption className="flex items-baseline justify-between gap-3">
        <span className="font-semibold">{title}</span>
        <span className="text-sm text-mute tabular-nums">toplam {format(total)}</span>
      </figcaption>
      <div className="mt-4 flex h-32 items-end gap-[2px]" role="img" aria-label={`${title}: günlük, toplam ${format(total)}`}>
        {data.map((d) => (
          <div key={d.day} className="group relative flex h-full flex-1 items-end">
            <div
              className="w-full rounded-t-[4px] bg-neon/80 group-hover:bg-neon"
              style={{ height: d.value ? `${Math.max(3, (d.value / max) * 100)}%` : "1px", opacity: d.value ? 1 : 0.25 }}
            />
            <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-line bg-ink px-2 py-1 text-xs group-hover:block">
              {label(d.day)} · <span className="tabular-nums">{format(d.value)}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-xs text-mute">
        <span>{data[0] ? label(data[0].day) : ""}</span>
        <span>{data.at(-1) ? label(data.at(-1)!.day) : ""}</span>
      </div>
    </figure>
  );
}
