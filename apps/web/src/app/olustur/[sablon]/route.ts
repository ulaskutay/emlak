import { TEMPLATES, TemplateId } from "@arsa/shared";
import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { site } from "@/lib/site";

/**
 * Sitedeki "Hemen oluşturun" bağlantısı: oturum varsa şablonun formuna,
 * yoksa kayda gider; kayıttan sonra aynı forma döner.
 * Proxy arkasında req.url iç adresi (127.0.0.1:3050) taşır; yönlendirme sitenin dış adresine kurulur.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ sablon: string }> }) {
  const id = TemplateId.safeParse((await params).sablon);
  if (!id.success || TEMPLATES[id.data].hidden) return NextResponse.redirect(new URL("/sablonlar", site.url));
  const form = `/panel/yeni/${id.data}`;
  const target = (await getSession()) ? form : `/kayit?sonra=${encodeURIComponent(form)}`;
  return NextResponse.redirect(new URL(target, site.url));
}
