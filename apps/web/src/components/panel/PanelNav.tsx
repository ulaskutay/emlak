"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ICON: Record<string, React.ReactNode> = {
  sablonlar: <><rect x="3" y="3" width="6" height="6" rx="1.5" /><rect x="11" y="3" width="6" height="6" rx="1.5" /><rect x="3" y="11" width="6" height="6" rx="1.5" /><rect x="11" y="11" width="6" height="6" rx="1.5" /></>,
  videolar: <><rect x="3" y="4" width="11" height="12" rx="2" /><path d="m14 8.5 3.5-2v7l-3.5-2" /></>,
};

const NAV = [
  { href: "/panel", label: "Şablonlar", icon: "sablonlar" },
  { href: "/panel/videolar", label: "Videolarım", icon: "videolar" },
];

/** Şablon formları da "Şablonlar" altında sayılır. */
function useActive() {
  const path = usePathname();
  return (href: string) => (href === "/panel" ? path === "/panel" || path.startsWith("/panel/yeni") : path.startsWith(href));
}

const Icon = ({ name }: { name: string }) => (
  <svg viewBox="0 0 20 20" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {ICON[name]}
  </svg>
);

/** Geniş ekranda sol menü. */
export function PanelNav() {
  const active = useActive();
  return (
    <nav aria-label="Panel menüsü" className="flex flex-col gap-1">
      {NAV.map((n) => {
        const on = active(n.href);
        return (
          <Link
            key={n.href}
            href={n.href}
            aria-current={on ? "page" : undefined}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[0.9375rem] font-semibold transition ${
              on ? "bg-gok-acik text-gok-koyu" : "text-gri hover:bg-zemin hover:text-lacivert"
            }`}
          >
            <Icon name={n.icon} />
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Telefonda başparmak erişiminde alt sekme çubuğu. */
export function PanelTabBar() {
  const active = useActive();
  return (
    <nav
      aria-label="Panel menüsü"
      className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-2 border-t border-ayrac bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      {NAV.map((n) => {
        const on = active(n.href);
        return (
          <Link
            key={n.href}
            href={n.href}
            aria-current={on ? "page" : undefined}
            className={`flex h-16 flex-col items-center justify-center gap-1 text-xs font-bold ${on ? "text-gok" : "text-gri"}`}
          >
            <span className={`grid h-7 w-12 place-items-center rounded-full ${on ? "bg-gok-acik" : ""}`}>
              <Icon name={n.icon} />
            </span>
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}
