"use client";
import { useState } from "react";

/** Boş oda ile döşenmiş hali ("Boş evi döşe" videosunun çocuk odası kareleri): sürgü kullanıcının elinde, hareket yalnız onun eylemine yanıt verir. */
export function OnceSonra({ once, sonra, className = "" }: { once: string; sonra: string; className?: string }) {
  const [p, setP] = useState(50);
  return (
    <div className={`relative overflow-hidden rounded-2xl bg-black select-none ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={once} alt="Boş oda" className="block aspect-[4/5] w-full object-cover" draggable={false} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={sonra}
        alt="Aynı oda, sanal eşyayla döşenmiş"
        draggable={false}
        className="absolute inset-0 h-full w-full object-cover"
        style={{ clipPath: `inset(0 0 0 ${p}%)` }}
      />
      <div aria-hidden className="absolute inset-y-0 w-0.5 bg-gunes" style={{ left: `${p}%` }}>
        <span className="absolute top-1/2 left-1/2 grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-gunes text-lacivert shadow-lg">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 6l-5 6 5 6M15 6l5 6-5 6" />
          </svg>
        </span>
      </div>
      <span className="absolute top-3 left-3 rounded-full bg-black/55 px-2.5 py-1 text-xs font-bold text-white backdrop-blur">Boş</span>
      <span className="absolute top-3 right-3 rounded-full bg-gunes px-2.5 py-1 text-xs font-bold text-lacivert">Döşenmiş</span>
      <input
        type="range"
        min={0}
        max={100}
        value={p}
        onChange={(e) => setP(Number(e.target.value))}
        aria-label="Boş ve döşenmiş oda arasında geçiş"
        className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0"
      />
    </div>
  );
}
