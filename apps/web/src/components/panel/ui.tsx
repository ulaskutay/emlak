import type { ReelStatus, TemplateId } from "@arsa/shared";
import Link from "next/link";
import { statusLabel, statusTone } from "@/components/status";

/** Sayfa başlığı; şablon formlarında geri bağlantısıyla. */
export function PanelTitle({ children, sub, back, aside }: {
  children: React.ReactNode;
  sub?: React.ReactNode;
  back?: { href: string; label: string };
  aside?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex min-w-0 flex-wrap items-end justify-between gap-x-6 gap-y-4 sm:mb-8">
      <div className="min-w-0 max-w-3xl">
        {back ? (
          <Link href={back.href} className="-ml-1 mb-2 inline-flex min-h-9 items-center gap-1 rounded-lg px-1 text-sm font-semibold text-gri hover:text-gok">
            <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden><path d="M12 5l-5 5 5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            {back.label}
          </Link>
        ) : null}
        <h1 className="text-[1.75rem] font-extrabold leading-tight tracking-[-0.03em] text-lacivert sm:text-[2rem]">{children}</h1>
        {sub ? <p className="mt-2 text-[0.9375rem] leading-relaxed text-gri">{sub}</p> : null}
      </div>
      {aside}
    </div>
  );
}

/** Durum rozeti: üretilirken aşamanın adı yazar. */
export function StatusBadge({ status, stage, template, className = "" }: {
  status: ReelStatus;
  stage?: string | null;
  template: TemplateId;
  className?: string;
}) {
  const s = statusTone[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${s.tone} ${className}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {statusLabel(status, stage, template)}
    </span>
  );
}

/** İnce ilerleme çubuğu (0..1). */
export function ProgressBar({ value, className = "" }: { value: number; className?: string }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div className={`h-2 overflow-hidden rounded-full bg-gok-acik ${className}`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
      <div className="h-full rounded-full bg-gok transition-[width] duration-700" style={{ width: `${Math.max(pct, 3)}%` }} />
    </div>
  );
}
