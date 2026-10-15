/** Stüdyo veri tipleri: tarayıcı (main.ts) ve Node tarafı (senaryo, kurgu, render) ortak kullanır. */
export interface ParcelInfo {
  name?: string;
  properties: Record<string, string>;
  ring: { lat: number; lng: number }[];
  centroid: { lat: number; lng: number };
  areaM2: number;
  radiusM: number;
  longestEdgeHeading: number;
  elevation: number | null;
  address: { province?: string; district?: string; neighbourhood?: string };
  pois: { label: string; emoji: string; name?: string; position: { lat: number; lng: number }; distanceM: number }[];
}

export interface Camera {
  lat: number;
  lng: number;
  /** Bakılan noktanın deniz seviyesine göre yüksekliği (m). */
  altitude: number;
  range: number;
  tilt: number;
  heading: number;
}

/** Bir karenin tüm görsel durumu; değerler 0..1 arası animasyon ilerlemesidir. */
export interface FrameState {
  camera: Camera;
  neon: number; // parsel konturunun çizilmiş oranı
  fill: number; // parsel dolgusunun görünürlüğü
  title: number; // m² kartı
  counter: number; // m² sayacının ilerlemesi
  location: number; // konum satırı
  lines: number[]; // her çevre noktası için parselden uzanan bağlantı çizgisinin çizilmiş oranı
  markers: number[]; // her çevre noktasının işaretçisi (>0 görünür)
  pills: number[]; // soldaki listede her çevre etiketinin ilerlemesi
  card: { index: number; progress: number } | null; // ortadaki büyük yer kartı
  /** Seslendirme altyazısı: o an okunan kelime parçası, active vurgulanan kelime, pop giriş animasyonu. */
  caption?: { words: string[]; active: number; pop: number } | null;
  /** Kapanış kartı (ofis, telefon, fiyat); progress 0..1. */
  endcard?: { officeName?: string; phone?: string; price?: string; progress: number } | null;
  /** İmar durumu: başlık kartının alt satırına eklenir. */
  zoning?: string;
  /** HYBRID: Google'ın yer/yol etiketleri görünür (çevre turunda), SATELLITE: sade uydu. */
  mode: "SATELLITE" | "HYBRID";
}
