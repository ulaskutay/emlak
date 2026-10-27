import Link from "next/link";
import { PanelNav, PanelTabBar } from "@/components/panel/PanelNav";
import { SignOut } from "@/components/SignOut";
import { SiteLogo } from "@/components/site/SiteLogo";
import { isSuperAdmin, requireUser } from "@/lib/auth";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const name = user.name || user.email;
  // Yönetim bağlantısı yalnız süper yöneticiye; rolle yönetici olanlar adresi bilerek girer.
  const admin = isSuperAdmin(user);
  return (
    <div className="panel min-h-dvh bg-zemin font-site text-lacivert lg:grid lg:grid-cols-[16.5rem_minmax(0,1fr)]">
      <aside className="sticky top-0 z-20 border-b border-ayrac bg-white/90 backdrop-blur lg:flex lg:h-dvh lg:flex-col lg:border-b-0 lg:border-r lg:bg-white">
        <div className="flex h-16 items-center justify-between gap-3 px-4 lg:h-auto lg:px-5 lg:pb-5 lg:pt-6">
          <Link href="/panel" aria-label="Panel" className="whitespace-nowrap">
            <SiteLogo />
          </Link>
          <div className="flex items-center gap-1 lg:hidden">
            {admin ? <Link href="/admin" className="rounded-full px-3 py-2 text-sm font-bold text-gok">Yönetim</Link> : null}
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gok text-sm font-extrabold uppercase text-white" title={name}>
              {name.slice(0, 1)}
            </span>
          </div>
        </div>
        <div className="hidden px-3 lg:block">
          <Link href="/panel" className="pnl-btn-primary mb-4 w-full">
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden><path d="M10 4v12M4 10h12" /></svg>
            Yeni video
          </Link>
          <PanelNav />
        </div>
        <div className="mt-auto hidden border-t border-ayrac p-3 lg:block">
          {admin ? (
            <Link href="/admin" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-gri hover:bg-zemin hover:text-lacivert">
              <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M8 4H4.5A1.5 1.5 0 0 0 3 5.5v10A1.5 1.5 0 0 0 4.5 17h10a1.5 1.5 0 0 0 1.5-1.5V12M11 3h6v6M17 3l-8 8" />
              </svg>
              Yönetim
            </Link>
          ) : null}
          <div className="mt-2 flex items-center gap-3 rounded-xl bg-zemin px-3 py-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gok text-sm font-extrabold uppercase text-white">{name.slice(0, 1)}</span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-bold">{user.name || "Hesabım"}</div>
              <div className="truncate text-xs text-gri">{user.email}</div>
            </div>
          </div>
          <SignOut className="mt-1 w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-gri hover:bg-mercan-acik hover:text-mercan-koyu" />
        </div>
      </aside>
      <main className="mx-auto w-full max-w-[84rem] px-4 pb-28 pt-6 sm:px-8 lg:py-10">
        {children}
        <div className="mt-12 flex items-center justify-between gap-4 border-t border-ayrac pt-5 text-sm lg:hidden">
          <span className="min-w-0 truncate text-gri">{user.email}</span>
          <SignOut className="shrink-0 rounded-lg px-2 py-2 font-semibold text-gri hover:text-mercan-koyu" />
        </div>
      </main>
      <PanelTabBar />
    </div>
  );
}
