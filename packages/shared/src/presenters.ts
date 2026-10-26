import { z } from "zod";

/**
 * Sanal sunucular ("element"): videolarda ilanı anlatan sabit karakterler. Her birinin referans görselleri
 * apps/worker/media/sunucular/<id>.jpg (ana) ve <id>-2.jpg (yüz yakın), panel küçük resmi
 * apps/web/public/media/sunucular/<id>.jpg. Görsel üretiminde (Seedream) iki referans birlikte verilir.
 * Kimlik görsellerinin tamamı assets/karakter altında (git dışı).
 */
export const PRESENTER_IDS = ["defne", "murat", "kemal", "nesrin", "elif"] as const;
export const PresenterId = z.enum(PRESENTER_IDS);
export type PresenterId = z.infer<typeof PresenterId>;

export interface PresenterInfo {
  id: PresenterId;
  name: string;
  /** Panelde adın altında: yaş ve tarz. */
  blurb: string;
  gender: "female" | "male";
  /** Prompt'ta kişiyi tarif eden kısa ad: "the woman in the green blazer". */
  who: string;
  /** Görünüm (prompt'a girer, referans görselle aynı kıyafet). */
  look: string;
  /** Konuşma sesi tarifi (video modeli sesi kendisi üretir). */
  voice: string;
  /** Higgsfield Soul 2.0 kimliği (panel portresi `pnpm --filter @arsa/worker sunucu-portre` ile bundan üretilir). */
  soulId: string;
}

export const PRESENTERS: Record<PresenterId, PresenterInfo> = {
  defne: {
    id: "defne",
    name: "Defne",
    blurb: "30'lar · yeşil blazer, sıcak ve enerjik",
    gender: "female",
    who: "the woman in the green blazer",
    look: "long straight dark brown hair, emerald green blazer, white t-shirt, beige trousers",
    voice: "friendly and confident female voice",
    soulId: "97843f26-b779-4327-a337-c20ff8d1df7b",
  },
  murat: {
    id: "murat",
    name: "Murat",
    blurb: "40'lar · lacivert takım, güven veren",
    gender: "male",
    who: "the man in the navy blue suit",
    look: "short salt-and-pepper hair, short trimmed beard, navy blue suit, light blue shirt, no tie",
    voice: "warm, calm and trustworthy male voice",
    soulId: "b464ff23-a674-47ad-be61-3556a0bfdbb1",
  },
  kemal: {
    id: "kemal",
    name: "Kemal",
    blurb: "50'ler · gri takım, gözlüklü, babacan",
    gender: "male",
    who: "the man with glasses in the grey suit",
    look: "grey hair combed back, short grey beard, thin metal glasses, charcoal grey suit, white shirt, burgundy tie",
    voice: "deep, warm and experienced fatherly male voice",
    soulId: "b23feb49-6963-41ee-9c2d-82fa3da41e73",
  },
  nesrin: {
    id: "nesrin",
    name: "Nesrin",
    blurb: "40'lar · krem blazer, zarif",
    gender: "female",
    who: "the woman in the cream white blazer",
    look: "shoulder-length honey brown bob haircut, cream white blazer, black top, black trousers, pearl stud earrings",
    voice: "elegant, warm and composed female voice",
    soulId: "e7086f62-b18d-43d7-b549-265d6d1fcbe0",
  },
  elif: {
    id: "elif",
    name: "Elif",
    blurb: "30'lar · lacivert blazer, profesyonel",
    gender: "female",
    who: "the woman in the navy blue blazer",
    look: "dark hair in a neat low bun, navy blue tailored blazer, light grey blouse, light grey trousers, thin gold necklace",
    voice: "clear, professional and friendly female voice",
    soulId: "44b48928-f755-4e8b-bd55-fc7327af7397",
  },
};

export const presenterList = PRESENTER_IDS.map((id) => PRESENTERS[id]);
