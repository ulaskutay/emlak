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
  /** category: @arsa/geo PoiCategory (sea, town, village, hospital, custom...). */
  pois: { category?: string; label: string; emoji: string; name?: string; position: { lat: number; lng: number }; distanceM: number }[];
  /** Mahalle / köy sınırı (TKGM ya da OSM); yoksa bölge sahnesi yalnızca pinle. */
  hood?: { name: string; ring: { lat: number; lng: number }[]; source?: string } | null;
}

export interface Camera {
  lat: number;
  lng: number;
  /** Bakılan noktanın deniz seviyesine göre yüksekliği (m). */
  altitude: number;
  range: number;
  tilt: number;
  heading: number;
  /** Drone yatışı (derece, dönüşe doğru); yalnızca Cesium motoru uygular. */
  roll?: number;
}

/** Özellik kutucuğu (ekranda soldan kayarak gelir). */
export interface FeatureChip {
  icon: string;
  label: string;
  value: string;
  /** 0..1 giriş/çıkış animasyonu */
  progress: number;
}

/**
 * Bir karenin tüm görsel durumu; değerler 0..1 arası animasyon ilerlemesidir.
 * Kurgu arsanın etrafında döner: kanca → mahalle sınırı + pin → tarama + m² → özellik kutucukları → kapanış.
 */
export interface FrameState {
  camera: Camera;
  /** HYBRID: Google'ın yer/yol etiketleri görünür, SATELLITE: sade uydu. */
  mode: "SATELLITE" | "HYBRID";
  /** Parsel konturunun çizilmiş oranı ve dolgusu. */
  neon: number;
  fill: number;
  /** Mahalle sınırı: çizim oranı, dolgu ve çizginin görünürlüğü. */
  hood?: { draw: number; fill: number; opacity: number } | null;
  /** Parsel pini: drop gökten inişi (0..1), pulse dalga halkalarının fazı (sürekli artar), opacity. */
  pin?: { drop: number; pulse: number; opacity: number } | null;
  /** Arazi taraması: tarama çizgisinin konumu (0..1), çizginin görünürlüğü, ızgaranın görünürlüğü. */
  scan?: { progress: number; line: number; grid: number } | null;
  /** Parselin etrafında yükselen ışıklı çit duvarı (0..1 yükselme). */
  fence?: number;
  /** Büyük açılış başlığı (kanca). */
  hook?: { lines: string[]; progress: number } | null;
  /** Mahalle / konum etiketi. */
  place?: { title: string; sub: string; progress: number } | null;
  /** m² rozeti: progress görünürlük, counter sayaç (0..1), sub alt satır. */
  area?: { progress: number; counter: number; sub?: string } | null;
  /** Özellik kutucukları. */
  features?: FeatureChip[];
  /** Seslendirme altyazısı: o an okunan kelime parçası, active vurgulanan kelime, pop giriş animasyonu. */
  caption?: { words: string[]; active: number; pop: number } | null;
  /** Kapanış kartı (ofis, telefon, fiyat); progress 0..1. */
  endcard?: { officeName?: string; phone?: string; price?: string; progress: number } | null;
  /** Kesme parlaması (0..1). */
  flash?: number;
  /** Danışman şeridi (ofis, telefon) altta; progress 0..1. */
  contact?: { officeName?: string; phone?: string; progress: number } | null;
}
