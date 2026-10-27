import { TEMPLATES, templateList, type TemplateId, type TemplateInfo } from "@arsa/shared";
import chapters from "./tutorial-chapters.json";

/**
 * Ana sayfadaki "Nasıl yapılır" videoları: panelin ekran kaydı + sonunda şablonun örnek çıktısı.
 * Videolar public/media/nasil/<id>.mp4; bölüm zamanları kayıt betiğinden
 * (apps/drone-studio/scripts/tutorials.ts) tutorial-chapters.json'a yazılır.
 */
export interface Tutorial {
  template: TemplateInfo;
  video: string;
  poster: string;
  chapters: { t: number; label: string }[];
}

const byId = chapters as Partial<Record<TemplateId, Tutorial["chapters"]>>;

export const tutorials: Tutorial[] = templateList
  .filter((t) => byId[t.id]?.length)
  .map((t) => ({
    template: TEMPLATES[t.id],
    video: `/media/nasil/${t.id}.mp4`,
    poster: `/media/nasil/${t.id}.jpg`,
    chapters: byId[t.id]!,
  }));

/** Sitedeki "Hemen oluşturun" bağlantısı: oturuma göre forma ya da kayda gider (app/olustur). */
export const createHref = (id: TemplateId) => `/olustur/${id}`;
