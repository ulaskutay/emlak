"use client";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function SignOut({ className = "text-sm text-mute hover:text-white" }: { className?: string }) {
  const router = useRouter();
  return (
    <button
      className={className}
      onClick={async () => {
        await authClient.signOut();
        router.replace("/giris");
        router.refresh();
      }}
    >
      Çıkış
    </button>
  );
}
