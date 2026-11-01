import { AuthForm } from "@/components/AuthForm";
import { AuthShell } from "@/components/auth/AuthShell";
import { googleEnabled } from "@/lib/auth";
import { safeNext } from "@/lib/next-path";

type Q = { sonra?: string | string[]; engelli?: string; sifre?: string };

export const metadata = { title: "Giriş · Arsa Video" };
export default async function Page({ searchParams }: { searchParams: Promise<Q> }) {
  const q = await searchParams;
  const next = safeNext(q.sonra);
  const notice = q.engelli ? "engelli" : q.sifre === "yenilendi" ? "sifre" : undefined;
  return (
    <AuthShell next={next}>
      <AuthForm mode="login" next={next} google={await googleEnabled()} notice={notice} />
    </AuthShell>
  );
}
