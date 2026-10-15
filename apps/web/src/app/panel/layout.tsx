import Link from "next/link";
import { Logo } from "@/components/Logo";
import { SignOut } from "@/components/SignOut";
import { requireUser } from "@/lib/auth";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-10 border-b border-line bg-ink/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link href="/panel">
            <Logo className="text-lg" />
          </Link>
          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-mute sm:inline">{user.name || user.email}</span>
            <SignOut />
            <Link href="/panel/yeni" className="btn-primary">
              + Yeni video
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
