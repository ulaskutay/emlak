import { TEMPLATES, TemplateId } from "@arsa/shared";
import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth";

/**
 * Sitedeki "Hemen oluşturun" bağlantısı: oturum varsa şablonun formuna,
 * yoksa kayda gider; kayıttan sonra aynı forma döner.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ sablon: string }> }) {
  const id = TemplateId.safeParse((await params).sablon);
  if (!id.success || TEMPLATES[id.data].hidden) return NextResponse.redirect(new URL("/sablonlar", req.url));
  const form = `/panel/yeni/${id.data}`;
  const target = (await getSession()) ? form : `/kayit?sonra=${encodeURIComponent(form)}`;
  return NextResponse.redirect(new URL(target, req.url));
}
