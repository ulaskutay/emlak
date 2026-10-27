import { AuthForm } from "@/components/AuthForm";
import { safeNext } from "@/lib/next-path";

export const metadata = { title: "Giriş · Arsa Video Stüdyo" };
export default async function Page({ searchParams }: { searchParams: Promise<{ sonra?: string | string[] }> }) {
  return <AuthForm mode="login" next={safeNext((await searchParams).sonra)} />;
}
