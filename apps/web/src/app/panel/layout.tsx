import Link from "next/link";
import { SignOut } from "@/components/SignOut";
import { SiteLogo } from "@/components/site/SiteLogo";
import { isSuperAdmin, requireUser } from "@/lib/auth";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-10 border-b border-line bg-ink/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-8">
            <Link href="/panel" aria-label="Panel">
              <SiteLogo tone="dark" />
            </Link>
            <nav aria-label="Panel menüsü" className="hidden gap-6 text-[0.9375rem] sm:flex">
              <Link href="/panel" className="text-mute hover:text-white">Şablonlar</Link>
              <Link href="/panel/videolar" className="text-mute hover:text-white">Videolarım</Link>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            {/* Yönetim bağlantısı yalnız süper yöneticiye; rolle yönetici olanlar adresi bilerek girer. */}
            {isSuperAdmin(user) ? <Link href="/admin" className="text-sm font-semibold text-neon hover:brightness-110">Yönetim</Link> : null}
            <span className="hidden text-sm text-mute md:inline">{user.name || user.email}</span>
            <SignOut />
          </div>
        </div>
        <nav aria-label="Panel menüsü" className="flex gap-6 border-t border-line px-4 py-2.5 text-sm sm:hidden">
          <Link href="/panel" className="text-mute hover:text-white">Şablonlar</Link>
          <Link href="/panel/videolar" className="text-mute hover:text-white">Videolarım</Link>
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
