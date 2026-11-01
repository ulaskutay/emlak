/**
 * Arsanın yandan yakın çekiminin kamerası (inşaat videosunun başlangıç karesi). Tarayıcı (yaklaşma kaydı, approach.ts)
 * ve Node (scripts/side.ts, RunPod yan kare işi) aynı hesabı kullanır: yaklaşma tam bu kamerada biter.
 */
import type { FrameState, ParcelInfo } from "./types.js";

export interface SideShot {
  /** Parselin en uzun kenarına göre bakış yönü (derece). */
  heading: number;
  /** Yatay uzaklık: parsel yarıçapının katı. */
  dist: number;
  /** Kameranın yerden yüksekliği (m). */
  height: number;
}

/**
 * Varsayılan açı: en uzun kenara dik, 1,6 yarıçap uzaktan, ~40° aşağı bakan drone açısı (yükseklik uzaklığın ~%84'ü).
 * Arsa üstten görünür, ufuk karenin üst kenarında ince bir şerit kalır. 2026-11-01'e kadar ~17° idi; kullanıcı "çok
 * yandan" buldu (yakın Cesium karosu da alçakta daha bulanık).
 */
export function defaultSideShot(p: ParcelInfo): SideShot {
  const D = Math.max(25, p.radiusM) * 1.6;
  return { heading: 90, dist: 1.6, height: Math.round(Math.min(250, Math.max(30, D * 0.84))) };
}

/** Yandan alçak kamera: yatay uzaklık D, yükseklik H → Cesium range/tilt (tilt = 90 + pitch). */
export function sideState(p: ParcelInfo, s: SideShot): FrameState {
  const D = Math.max(25, p.radiusM) * s.dist;
  return {
    camera: {
      lat: p.centroid.lat,
      lng: p.centroid.lng,
      altitude: 0,
      range: Math.hypot(D, s.height),
      tilt: 90 - (Math.atan2(s.height, D) * 180) / Math.PI,
      heading: p.longestEdgeHeading + s.heading,
    },
    mode: "SATELLITE",
    neon: 0,
    fill: 0,
    fence: 0,
  };
}

