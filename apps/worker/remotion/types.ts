/** İlan videosu kompozisyonunun girdisi: zaman çizelgesi worker'da (seslendirme sürelerinden) kare cinsinden kurulur. */

/** Fotoğraf üstündeki kamera hareketi: yaklaşma, uzaklaşma, sağa/sola kaydırma (geniş fotoğrafta). */
export type Move = "push" | "pull" | "panRight" | "panLeft";

/** Sahnenin girişi; önceki sahne aynı türün çıkışını oynar. */
export type Transition = "slide" | "zoom" | "rise" | "iris";

export interface IlanScene {
  src: string;
  width: number;
  height: number;
  /** Kadrajın yatay odağı (0 sol, 1 sağ). */
  focusX: number;
  title?: string;
  move: Move;
  transition: Transition;
  /** Sahnenin tam görünür olduğu ilk kare; giriş geçişi bundan TRANSITION kare önce başlar (ilk sahne hariç). */
  from: number;
  frames: number;
}

export interface IlanVideoProps {
  [key: string]: unknown;
  fps: number;
  durationInFrames: number;
  /** Geçiş süresi (kare). */
  transition: number;
  /** Yazı tiplerinin adresi (sonunda / ile). */
  fontBase: string;
  scenes: IlanScene[];
  /** İlk sahnedeki ilan kimliği: "Satılık Daire", konum, "3+1 · 145 m²". */
  intro?: { kind?: string; location?: string; facts: string[] };
  outro: {
    from: number;
    frames: number;
    transition: Transition;
    background: string;
    price?: string;
    priceLabel: string;
    name?: string;
    office?: string;
    phone?: string;
    photo?: string;
    logo?: string;
  };
  audio: {
    music?: string;
    voice: { src: string; from: number; frames: number }[];
    whoosh?: string;
    /** Geçiş efektlerinin kareleri (geçişin ortası). */
    whooshAt: number[];
  };
}
