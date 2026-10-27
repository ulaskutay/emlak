import Link from "next/link";
import { SignOut } from "@/components/SignOut";
import { SiteLogo } from "@/components/site/SiteLogo";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Yönetim · Arsa Video", robots: { index: false } };

const NAV = [
  { href: "/admin", label: "Özet" },
  { href: "/admin/kullanicilar", label: "Kullanıcılar" },
  { href: "/admin/uretimler", label: "Üretimler" },
  { href: "/admin/odemeler", label: "Ödemeler" },
  { href: "/admin/ayarlar", label: "Ayarlar" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-10 border-b border-line bg-ink/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-3">
            <Link href="/admin" aria-label="Yönetim">
              <SiteLogo tone="dark" />
            </Link>
            <span className="rounded-md bg-neon/15 px-2 py-0.5 text-xs font-bold text-neon">Yönetim</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/panel" className="text-sm text-mute hover:text-white">Kullanıcı paneli</Link>
            <span className="hidden text-sm text-mute md:inline">{user.email}</span>
            <SignOut />
          </div>
        </div>
        <nav aria-label="Yönetim menüsü" className="mx-auto flex max-w-7xl gap-6 overflow-x-auto border-t border-line px-4 py-2.5 text-sm">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="shrink-0 text-mute hover:text-white">{n.label}</Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8">{children}</main>
    </div>
  );
}
