import { and, eq, getDb, videos } from "@arsa/db";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { VideoStatus } from "./VideoStatus";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const [v] = await getDb()
    .select({ id: videos.id })
    .from(videos)
    .where(and(eq(videos.id, id), eq(videos.userId, user.id)));
  if (!v) notFound();
  return <VideoStatus id={id} />;
}
