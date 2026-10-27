import { AuthForm } from "@/components/AuthForm";
import { safeNext } from "@/lib/next-path";

export const metadata = { title: "Kayıt · Arsa Video Stüdyo" };
export default async function Page({ searchParams }: { searchParams: Promise<{ sonra?: string | string[] }> }) {
  return <AuthForm mode="signup" next={safeNext((await searchParams).sonra)} />;
}
