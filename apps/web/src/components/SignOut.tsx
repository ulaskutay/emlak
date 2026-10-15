"use client";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function SignOut() {
  const router = useRouter();
  return (
    <button
      className="text-sm text-mute hover:text-white"
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
