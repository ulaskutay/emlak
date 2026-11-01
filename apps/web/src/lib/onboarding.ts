import "server-only";
import { eq, getDb, user } from "@arsa/db";

/** Karşılama durumu: oturumda olmayan alanlar doğrudan tablodan okunur. */
export async function onboardingState(userId: string) {
  const [row] = await getDb()
    .select({ segments: user.segments, onboardedAt: user.onboardedAt, termsAcceptedAt: user.termsAcceptedAt })
    .from(user)
    .where(eq(user.id, userId));
  return row ?? { segments: null, onboardedAt: null, termsAcceptedAt: null };
}
