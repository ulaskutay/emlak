import { AuthForm } from "@/components/AuthForm";
import { AuthShell } from "@/components/auth/AuthShell";
import { googleEnabled } from "@/lib/auth";
import { safeNext } from "@/lib/next-path";

export const metadata = { title: "Kayıt · Arsa Video" };
export default async function Page({ searchParams }: { searchParams: Promise<{ sonra?: string | string[] }> }) {
  const next = safeNext((await searchParams).sonra);
  return (
    <AuthShell next={next}>
      <AuthForm mode="signup" next={next} google={googleEnabled} />
    </AuthShell>
  );
}
