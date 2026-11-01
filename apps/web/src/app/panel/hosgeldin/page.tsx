import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { safeNext } from "@/lib/next-path";
import { onboardingState } from "@/lib/onboarding";
import { Onboarding } from "./Onboarding";

export const dynamic = "force-dynamic";
export const metadata = { title: "Hoş geldiniz · Arsa Video" };

export default async function Page({ searchParams }: { searchParams: Promise<{ sonra?: string | string[] }> }) {
  const u = await requireUser();
  const next = safeNext((await searchParams).sonra);
  const state = await onboardingState(u.id);
  // Şablonu seçip gelen ve onayı olan kullanıcı karşılamayı atlar.
  if (next && state.termsAcceptedAt) redirect(next);
  return <Onboarding name={u.name} needsTerms={!state.termsAcceptedAt} next={next} initial={state.segments ?? []} />;
}
