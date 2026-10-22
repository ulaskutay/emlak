import { TEMPLATES, TemplateId } from "@arsa/shared";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BitmisForm } from "../BitmisForm";
import { DosemeForm } from "../DosemeForm";
import { IlanForm } from "../IlanForm";
import { InsaatForm } from "../InsaatForm";
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
      <Link href="/panel" className="mx-auto mb-4 block max-w-3xl text-sm text-mute hover:text-white">
        Şablonlar
      </Link>
      {id.data === "arsa-drone" && <Wizard />}
      {id.data === "ilan-videosu" && <IlanForm />}
      {id.data === "bitmis-hali" && <BitmisForm template={id.data} />}
      {id.data === "insaat-videosu" && <InsaatForm />}
      {id.data === "dosenmis-ev" && <DosemeForm />}
    </>
  );
}
