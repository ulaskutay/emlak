import Link from "next/link";
import { AdminNav } from "@/components/admin/AdminNav";
import { SignOut } from "@/components/SignOut";
import { SiteLogo } from "@/components/site/SiteLogo";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Yönetim · Arsa Video", robots: { index: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  const name = user.name || user.email;
  return (
    <div className="admin min-h-dvh bg-zemin font-site text-lacivert lg:grid lg:grid-cols-[16.5rem_minmax(0,1fr)]">
      <aside className="sticky top-0 z-20 border-b border-ayrac bg-white/90 backdrop-blur lg:flex lg:h-dvh lg:flex-col lg:border-b-0 lg:border-r lg:bg-white">
        <div className="flex h-16 items-center justify-between gap-3 px-4 lg:h-auto lg:flex-col lg:items-start lg:gap-2 lg:px-5 lg:pb-6 lg:pt-6">
          <Link href="/admin" aria-label="Yönetim" className="whitespace-nowrap">
            <SiteLogo />
          </Link>
          <span className="rounded-full bg-gunes-acik px-2.5 py-0.5 text-xs font-extrabold text-[#8a5d00]">Yönetim</span>
        </div>
        <div className="px-3 pb-3 lg:flex-1 lg:pb-0">
          <AdminNav />
        </div>
        <div className="hidden border-t border-ayrac p-3 lg:block">
          <Link href="/panel" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-gri hover:bg-zemin hover:text-lacivert">
            <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M8 4H4.5A1.5 1.5 0 0 0 3 5.5v10A1.5 1.5 0 0 0 4.5 17h10a1.5 1.5 0 0 0 1.5-1.5V12M11 3h6v6M17 3l-8 8" />
            </svg>
            Kullanıcı paneli
          </Link>
          <div className="mt-2 flex items-center gap-3 rounded-xl bg-zemin px-3 py-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gok text-sm font-extrabold uppercase text-white">{name.slice(0, 1)}</span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-bold">{user.name || "Yönetici"}</div>
              <div className="truncate text-xs text-gri">{user.email}</div>
            </div>
          </div>
          <SignOut className="mt-1 w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-gri hover:bg-mercan-acik hover:text-mercan-koyu" />
        </div>
      </aside>
      <main className="mx-auto w-full max-w-[84rem] px-4 py-8 sm:px-8 lg:py-10">
        {children}
        <div className="mt-12 flex gap-4 border-t border-ayrac pt-5 text-sm lg:hidden">
          <Link href="/panel" className="font-semibold text-gri hover:text-gok">Kullanıcı paneli</Link>
          <SignOut className="font-semibold text-gri hover:text-mercan-koyu" />
        </div>
      </main>
    </div>
  );
}
