import { TEMPLATES, TemplateId } from "@arsa/shared";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BitmisForm } from "../BitmisForm";
import { DosemeForm } from "../DosemeForm";
import { InsaatForm } from "../InsaatForm";
import { getPricing } from "@/lib/credits";
import { Wizard } from "../Wizard";

export async function generateMetadata({ params }: { params: Promise<{ sablon: string }> }) {
  const id = TemplateId.safeParse((await params).sablon);
  return { title: `${id.success ? TEMPLATES[id.data].name : "Yeni video"} · Arsa Video` };
}

export default async function Page({ params }: { params: Promise<{ sablon: string }> }) {
  const id = TemplateId.safeParse((await params).sablon);
  if (!id.success || TEMPLATES[id.data].hidden) notFound();
  return (
    <>
      <div className="mx-auto mb-2 max-w-3xl">
        <Link href="/panel" className="-ml-1 inline-flex min-h-9 items-center gap-1 rounded-lg px-1 text-sm font-semibold text-gri hover:text-gok">
          <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden><path d="M12 5l-5 5 5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          Şablonlar
        </Link>
      </div>
      {id.data === "arsa-drone" && <Wizard />}
      {id.data === "ilan-videosu" && <DosemeForm template="ilan-videosu" />}
      {id.data === "bitmis-hali" && <BitmisForm template={id.data} />}
      {id.data === "insaat-videosu" && <InsaatForm />}
      {id.data === "dosenmis-ev" && <DosemeForm />}
      {id.data === "sunucu-ev" && <DosemeForm template="sunucu-ev" tourCredits={(await getPricing()).tourCredits} />}
    </>
  );
}
