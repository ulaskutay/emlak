import type { MetadataRoute } from "next";
import { TEMPLATE_IDS } from "@arsa/shared";
import { site } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = ["", "/sablonlar", ...TEMPLATE_IDS.map((id) => `/sablonlar/${id}`), "/iletisim", "/kvkk", "/gizlilik", "/cerez", "/kullanim-kosullari"];
  return pages.map((p) => ({
    url: `${site.url}${p}`,
    changeFrequency: p === "" ? "weekly" : "yearly",
    priority: p === "" ? 1 : 0.3,
  }));
}
