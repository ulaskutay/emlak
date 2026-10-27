/** Arsa kartının görseli: uydu görüntüsündeki parselin üstünde süzülen drone. */
export function ArsaDrone() {
  return (
    <div aria-hidden className="relative h-40 overflow-hidden rounded-2xl bg-lacivert">
      <img src="/media/arsa-kart.jpg" alt="" className="uydu-kay absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-t from-lacivert/40 via-lacivert/10 to-lacivert/20" />
      <div className="drone-tur absolute top-3 left-1/2 -ml-16 w-32">
        <div className="absolute top-[6.5rem] left-1/2 h-3.5 w-20 -translate-x-1/2 rounded-full bg-black/35 blur-[5px]" />
        <img src="/media/drone.webp" alt="" className="suzul relative w-full drop-shadow-[0_8px_10px_rgba(0,0,0,.45)]" />
      </div>
      <span className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-bold text-lacivert">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-mercan" />
        Parsel sınırıyla havadan tur
      </span>
    </div>
  );
}
