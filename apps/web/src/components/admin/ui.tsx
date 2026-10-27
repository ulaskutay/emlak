import type { ReelStatus } from "@arsa/shared";
import Link from "next/link";

export function PageTitle({ children, sub, back }: { children: React.ReactNode; sub?: React.ReactNode; back?: { href: string; label: string } }) {
  return (
    <div className="mb-7 min-w-0">
      {back ? (
        <Link href={back.href} className="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-gri hover:text-gok">
          <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden><path d="M12 5l-5 5 5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          {back.label}
        </Link>
      ) : null}
      <h1 className="text-[1.75rem] font-extrabold leading-tight tracking-[-0.03em] text-lacivert">{children}</h1>
      {sub ? <p className="mt-1.5 text-sm text-gri">{sub}</p> : null}
    </div>
  );
}

/** Bölüm başlığı: tabloların ve formların üstünde. */
export function SectionTitle({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="mb-3 mt-10 flex items-baseline justify-between gap-3">
      <h2 className="text-lg font-extrabold tracking-[-0.02em]">{children}</h2>
      {aside ? <div className="text-sm text-gri">{aside}</div> : null}
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone,
  featured,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: "good" | "bad";
  featured?: boolean;
}) {
  if (featured) {
    return (
      <div className="relative overflow-hidden rounded-2xl bg-lacivert p-5 text-white shadow-[0_16px_32px_-20px_rgba(13,27,62,.8)]">
        <div aria-hidden className="absolute -right-8 -top-10 h-32 w-32 rounded-full bg-gok/40 blur-2xl" />
        <div className="relative text-[0.8125rem] font-semibold text-white/70">{label}</div>
        <div className={`relative mt-1.5 text-[1.75rem] font-extrabold tracking-[-0.03em] tabular-nums ${tone === "bad" ? "text-mercan" : ""}`}>{value}</div>
        {hint ? <div className="relative mt-1 text-xs text-white/60">{hint}</div> : null}
      </div>
    );
  }
  return (
    <div className="adm-kart p-5">
      <div className="text-[0.8125rem] font-semibold text-gri">{label}</div>
      <div className={`mt-1.5 text-[1.75rem] font-extrabold tracking-[-0.03em] tabular-nums ${tone === "good" ? "text-cimen-koyu" : tone === "bad" ? "text-mercan-koyu" : "text-lacivert"}`}>
        {value}
      </div>
      {hint ? <div className="mt-1 text-xs text-gri">{hint}</div> : null}
    </div>
  );
}

const STATUS: Record<ReelStatus, { text: string; tone: string; dot: string }> = {
  queued: { text: "Sırada", tone: "bg-slate-100 text-slate-600", dot: "bg-slate-400" },
  running: { text: "Üretiliyor", tone: "bg-gok-acik text-gok-koyu", dot: "bg-gok animate-pulse" },
  done: { text: "Hazır", tone: "bg-cimen-acik text-cimen-koyu", dot: "bg-cimen" },
  failed: { text: "Hata", tone: "bg-mercan-acik text-mercan-koyu", dot: "bg-mercan" },
};
export function StatusBadge({ status }: { status: ReelStatus }) {
  const s = STATUS[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold ${s.tone}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {s.text}
    </span>
  );
}

/** Küçük etiket: yönetici, engelli, tahmin gibi. */
export function Pill({ children, tone = "gok" }: { children: React.ReactNode; tone?: "gok" | "mercan" | "gri" }) {
  const c = tone === "gok" ? "bg-gok-acik text-gok-koyu" : tone === "mercan" ? "bg-mercan-acik text-mercan-koyu" : "bg-slate-100 text-slate-600";
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${c}`}>{children}</span>;
}

/** Sekme benzeri filtre bağlantıları (sorgu parametresiyle). */
export function Filters({ items, current }: { items: { label: string; href: string; value: string }[]; current: string }) {
  return (
    <div className="inline-flex max-w-full gap-1 overflow-x-auto rounded-full border border-ayrac bg-white p-1">
      {items.map((i) => (
        <Link
          key={i.value}
          href={i.href}
          aria-current={i.value === current ? "page" : undefined}
          className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${i.value === current ? "bg-lacivert text-white" : "text-gri hover:bg-zemin hover:text-lacivert"}`}
        >
          {i.label}
        </Link>
      ))}
    </div>
  );
}

export function Table({ head, children, empty }: { head: string[]; children: React.ReactNode; empty?: boolean }) {
  return (
    <div className="adm-kart overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="border-b border-ayrac bg-zemin/70 text-[0.6875rem] uppercase tracking-[0.06em] text-gri">
          <tr>{head.map((h) => <th key={h} className="px-4 py-3 font-bold">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-ayrac [&>tr]:transition-colors [&>tr:hover]:bg-gok-acik/35">{children}</tbody>
      </table>
      {empty ? <p className="p-8 text-center text-sm text-gri">Kayıt yok</p> : null}
    </div>
  );
}

/** Tek serili günlük çubuk grafik; çubuğun üzerine gelince gün ve değer görünür. */
export function DailyBars({ title, data, format }: { title: string; data: { day: string; value: number }[]; format: (n: number) => string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const total = data.reduce((a, d) => a + d.value, 0);
  const label = (day: string) => new Date(day).toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
  return (
    <figure className="adm-kart p-5">
      <figcaption>
        <div className="text-[0.8125rem] font-semibold text-gri">{title}</div>
        <div className="mt-0.5 text-xl font-extrabold tracking-[-0.02em] tabular-nums">{format(total)}</div>
      </figcaption>
      <div className="mt-4 flex h-28 items-end gap-[2px] border-b border-ayrac" role="img" aria-label={`${title}: günlük, toplam ${format(total)}`}>
        {data.map((d) => (
          <div key={d.day} className="group relative flex h-full flex-1 items-end">
            <div
              className={`w-full rounded-t-[3px] ${d.value ? "bg-gok/75 group-hover:bg-gok" : "bg-ayrac"}`}
              style={{ height: d.value ? `${Math.max(3, (d.value / max) * 100)}%` : "2px" }}
            />
            <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-lacivert px-2 py-1 text-xs font-semibold text-white shadow-lg group-hover:block">
              {label(d.day)} · <span className="tabular-nums">{format(d.value)}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-xs text-gri">
        <span>{data[0] ? label(data[0].day) : ""}</span>
        <span>{data.at(-1) ? label(data.at(-1)!.day) : ""}</span>
      </div>
    </figure>
  );
}
