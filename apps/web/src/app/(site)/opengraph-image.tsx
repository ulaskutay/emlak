import { ImageResponse } from "next/og";
import { parselCizimi } from "@/lib/ornek-parsel";

export const alt = "Arsa Video — Drone uçurmadan arsanızın drone videosu";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  const { points } = parselCizimi(560, 40);
  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", background: "#edefe8", color: "#1e2a23", padding: 72 }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: 620 }}>
          <div style={{ fontSize: 34, fontWeight: 700 }}>Arsa Video</div>
          <div style={{ fontSize: 76, fontWeight: 800, lineHeight: 1, letterSpacing: -3 }}>
            Drone uçurmadan arsanızın drone videosu.
          </div>
          <div style={{ fontSize: 28, color: "#4d5650" }}>TKGM parsel dosyasından Reels videosu</div>
        </div>
        <svg width="460" height="486" viewBox="0 0 560 560" style={{ marginLeft: 20 }}>
          <polygon points={points} fill="rgba(255,194,77,.18)" stroke="#1e2a23" strokeWidth="12" strokeLinejoin="round" />
          <polygon points={points} fill="none" stroke="#ffc24d" strokeWidth="6" strokeLinejoin="round" />
        </svg>
      </div>
    ),
    size,
  );
}
