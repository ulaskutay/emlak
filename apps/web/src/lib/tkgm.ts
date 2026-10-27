import "server-only";

/**
 * TKGM Parsel Sorgu (parselsorgu.tkgm.gov.tr) arka uç servisi. Anahtar istemez; il/ilçe/mahalle listeleri
 * ve mahalle + ada + parsel ile parsel sınırı döner. Tarayıcı CORS'a takılmasın diye sunucudan çağrılır.
 */
const BASE = "https://cbsapi.tkgm.gov.tr/megsiswebapi.v3.1/api";
const HEADERS = { "User-Agent": "Mozilla/5.0 (arsa-video)", Referer: "https://parselsorgu.tkgm.gov.tr/", Accept: "application/json" };

export type TkgmOption = { id: number; text: string };

async function get(path: string): Promise<Response> {
  try {
    return await fetch(`${BASE}/${path}`, { headers: HEADERS, signal: AbortSignal.timeout(15_000), cache: "no-store" });
  } catch {
    throw new Error("TKGM servisine ulaşılamadı, biraz sonra tekrar deneyin");
  }
}

// İdari yapı listeleri neredeyse hiç değişmez: süreç belleğinde bir gün tutulur.
const listCache = new Map<string, { at: number; items: TkgmOption[] }>();
const DAY = 86_400_000;

export async function tkgmList(kind: "il" | "ilce" | "mahalle", parentId?: number): Promise<TkgmOption[]> {
  const path = kind === "il" ? "idariYapi/ilListe" : `idariYapi/${kind}Liste/${parentId}`;
  const hit = listCache.get(path);
  if (hit && Date.now() - hit.at < DAY) return hit.items;
  const res = await get(path);
  if (!res.ok) throw new Error("TKGM listesi alınamadı, biraz sonra tekrar deneyin");
  const data = (await res.json()) as { features?: { properties: TkgmOption }[] };
  const items = (data.features ?? [])
    .map((f) => ({ id: f.properties.id, text: f.properties.text }))
    .sort((a, b) => a.text.localeCompare(b.text, "tr"));
  listCache.set(path, { at: Date.now(), items });
  return items;
}

/**
 * Mahalle + ada + parsel ile parseli sorgular; TKGM'nin "Dışa aktar → GeoJSON" çıktısıyla aynı biçimde
 * (Ada, ParselNo, Alan, Il, Ilce, Mahalle, Mevkii, Nitelik, Pafta) metin döner — yüklenen dosyayla aynı yoldan işlenir.
 */
export async function tkgmParcel(mahalleId: number, ada: string, parsel: string): Promise<string> {
  const res = await get(`parsel/${mahalleId}/${encodeURIComponent(ada)}/${encodeURIComponent(parsel)}`);
  if (res.status === 404) throw new Error(`${ada} ada ${parsel} parsel bu mahallede bulunamadı`);
  if (res.status === 429) throw new Error("TKGM çok fazla sorgu aldı, bir dakika sonra tekrar deneyin");
  if (!res.ok) throw new Error("TKGM sorgusu başarısız oldu, biraz sonra tekrar deneyin");
  const f = (await res.json()) as { geometry?: unknown; properties?: Record<string, unknown> };
  if (!f.geometry) throw new Error("TKGM bu parsel için sınır döndürmedi");
  const p = f.properties ?? {};
  const s = (k: string) => (p[k] == null ? "" : String(p[k]));
  return JSON.stringify({
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: f.geometry,
        properties: {
          ParselNo: s("parselNo"),
          Alan: s("alan"),
          Mevkii: s("mevkii"),
          Nitelik: s("nitelik"),
          Ada: s("adaNo"),
          Il: s("ilAd"),
          Ilce: s("ilceAd"),
          Pafta: s("pafta"),
          Mahalle: s("mahalleAd"),
        },
      },
    ],
    crs: { type: "name", properties: { name: "EPSG:4326" } },
  });
}
