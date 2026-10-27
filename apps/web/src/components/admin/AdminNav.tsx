"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ICON: Record<string, React.ReactNode> = {
  ozet: <path d="M3 10.5 10 4l7 6.5M5 9v7h4v-4h2v4h4V9" />,
  kullanicilar: <><circle cx="8" cy="7" r="3" /><path d="M2.5 16.5c.6-2.9 2.8-4.5 5.5-4.5s4.9 1.6 5.5 4.5M13 4.3a3 3 0 0 1 0 5.4M15 12.3c1.3.7 2.2 2.1 2.5 4.2" /></>,
  uretimler: <><rect x="3" y="4" width="11" height="12" rx="2" /><path d="m14 8.5 3.5-2v7l-3.5-2" /></>,
  odemeler: <><rect x="2.5" y="5" width="15" height="10.5" rx="2" /><path d="M2.5 8.5h15M5.5 12.5h3" /></>,
  ayarlar: <><circle cx="10" cy="10" r="2.5" /><path d="M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M4.7 15.3l1.4-1.4M13.9 6.1l1.4-1.4" /></>,
};

const NAV = [
  { href: "/admin", label: "Özet", icon: "ozet" },
  { href: "/admin/kullanicilar", label: "Kullanıcılar", icon: "kullanicilar" },
  { href: "/admin/uretimler", label: "Üretimler", icon: "uretimler" },
  { href: "/admin/odemeler", label: "Ödemeler", icon: "odemeler" },
  { href: "/admin/ayarlar", label: "Ayarlar", icon: "ayarlar" },
];

/** Yönetim menüsü: geniş ekranda dikey, dar ekranda yatay kayan. */
export function AdminNav() {
  const path = usePathname();
  const active = (href: string) => (href === "/admin" ? path === href : path.startsWith(href));
  return (
    <nav aria-label="Yönetim menüsü" className="flex gap-1 overflow-x-auto [scrollbar-width:none] lg:flex-col lg:overflow-visible">
      {NAV.map((n) => {
        const on = active(n.href);
        return (
          <Link
            key={n.href}
            href={n.href}
            aria-current={on ? "page" : undefined}
            className={`flex shrink-0 items-center gap-3 rounded-xl px-3 py-2 text-[0.9375rem] font-semibold transition lg:py-2.5 ${
              on ? "bg-gok-acik text-gok-koyu" : "text-gri hover:bg-zemin hover:text-lacivert"
            }`}
          >
            <svg viewBox="0 0 20 20" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              {ICON[n.icon]}
            </svg>
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}
