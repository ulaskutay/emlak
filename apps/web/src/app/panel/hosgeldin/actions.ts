"use server";
import { eq, getDb, user } from "@arsa/db";
import { TEMPLATE_CATEGORIES } from "@arsa/shared";
import { requireUser } from "@/lib/auth";
import { onboardingState } from "@/lib/onboarding";

/** Karşılamanın ilk adımı: ilan türleri ve (henüz alınmadıysa) koşul onayı. */
export async function saveOnboarding(input: { segments: string[]; terms: boolean }) {
  const u = await requireUser();
  const state = await onboardingState(u.id);
  if (!state.termsAcceptedAt && !input.terms) return { error: "Devam etmek için kullanım koşullarını ve KVKK metnini onaylayın" };
  const segments = input.segments.filter((s): s is string => (TEMPLATE_CATEGORIES as readonly string[]).includes(s));
  await getDb()
    .update(user)
    .set({ segments, onboardedAt: new Date(), termsAcceptedAt: state.termsAcceptedAt ?? new Date() })
    .where(eq(user.id, u.id));
  return { ok: true as const };
}
