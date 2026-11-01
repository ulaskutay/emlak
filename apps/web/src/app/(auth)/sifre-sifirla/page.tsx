import { AuthShell } from "@/components/auth/AuthShell";
import { ResetForm } from "@/components/auth/PasswordForms";

export const metadata = { title: "Yeni şifre · Arsa Video" };
export default async function Page({ searchParams }: { searchParams: Promise<{ token?: string; error?: string }> }) {
  const { token, error } = await searchParams;
  return (
    <AuthShell>
      <ResetForm token={typeof token === "string" && !error ? token : undefined} />
    </AuthShell>
  );
}
