import type { ReactNode } from "react";

/** Drone vizörünün dört köşe işareti; içeriği çerçeveler. Hero, anlatım çizimleri ve karşılaştırma kullanır. */
export function VizorCercevesi({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`relative p-2.5 ${className}`}>
      <span aria-hidden className="absolute top-0 left-0 h-7 w-7 rounded-tl-xl border-t-2 border-l-2 border-gunes" />
      <span aria-hidden className="absolute top-0 right-0 h-7 w-7 rounded-tr-xl border-t-2 border-r-2 border-gunes" />
      <span aria-hidden className="absolute bottom-0 left-0 h-7 w-7 rounded-bl-xl border-b-2 border-l-2 border-gunes" />
      <span aria-hidden className="absolute right-0 bottom-0 h-7 w-7 rounded-br-xl border-r-2 border-b-2 border-gunes" />
      {children}
    </div>
  );
}
