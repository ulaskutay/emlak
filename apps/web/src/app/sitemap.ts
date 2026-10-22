import type { MetadataRoute } from "next";
import { templateList } from "@arsa/shared";
import { site } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = ["", "/sablonlar", ...templateList.map((t) => `/sablonlar/${t.id}`), "/iletisim", "/kvkk", "/gizlilik", "/cerez", "/kullanim-kosullari"];
  return pages.map((p) => ({
    url: `${site.url}${p}`,
    changeFrequency: p === "" ? "weekly" : "yearly",
    priority: p === "" ? 1 : 0.3,
  }));
}
