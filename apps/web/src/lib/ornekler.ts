import { TEMPLATES, templateList, type TemplateId } from "@arsa/shared";

/** Örnekler sayfası ve ana sayfa şeridi: şablonların gerçek çıktıları (public/media). */
export interface Ornek {
  template: TemplateId;
  src?: string;
  poster: string;
}

const duvar = (template: TemplateId, name: string, video = true): Ornek => ({
  template,
  src: video ? `/media/duvar/${name}.mp4` : undefined,
  poster: `/media/duvar/${name}.jpg`,
});

/** Şablon başına ana örnek (şablonun kendi önizlemesi). */
export const sablonOrnekleri: Ornek[] = templateList.map((t) => ({ template: t.id, src: t.preview.video, poster: t.preview.poster }));

/** Aynı şablonlardan başka çıktılar: kısa döngüler. */
export const digerOrnekler: Ornek[] = [
  duvar("arsa-drone", "arsa-1"),
  duvar("ilan-videosu", "ilan-1"),
  duvar("arsa-drone", "arsa-2"),
  duvar("ilan-videosu", "ilan-3"),
  duvar("arsa-drone", "arsa-3"),
  duvar("ilan-videosu", "ilan-2"),
  duvar("arsa-drone", "arsa-4"),
  duvar("ilan-videosu", "ilan-4"),
  duvar("ilan-videosu", "ilan-5"),
  duvar("ilan-videosu", "ilan-6"),
  duvar("ilan-videosu", "ilan-7"),
  duvar("dosenmis-ev", "dosenmis-3"),
  duvar("ilan-videosu", "ilan-8"),
  duvar("sunucu-ev", "sunucu-1"),
  duvar("dosenmis-ev", "dosenmis-1"),
  duvar("insaat-videosu", "insaat-1"),
  duvar("sunucu-ev", "sunucu-2"),
  duvar("dosenmis-ev", "dosenmis-2"),
  duvar("insaat-videosu", "insaat-2"),
].filter((o) => !TEMPLATES[o.template].hidden);

/** Bir şablonun çıktıları: önce ana örnek, sonra kısa döngüler (en yeni önce). */
export const sablonCiktilari = (id: TemplateId): Ornek[] => [
  ...sablonOrnekleri.filter((o) => o.template === id),
  ...digerOrnekler.filter((o) => o.template === id).reverse(),
];

export const ornekAdi = (o: Ornek) => TEMPLATES[o.template].name;
