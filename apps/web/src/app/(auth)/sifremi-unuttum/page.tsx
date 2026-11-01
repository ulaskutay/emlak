import { AuthShell } from "@/components/auth/AuthShell";
import { ForgotForm } from "@/components/auth/PasswordForms";

export const metadata = { title: "Şifremi unuttum · Arsa Video" };
export default function Page() {
  return (
    <AuthShell>
      <ForgotForm />
    </AuthShell>
  );
}
