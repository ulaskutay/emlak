"use client";
import { useEffect, useRef, useState } from "react";

/**
 * İnşaat videosunun drone yaklaşma çekimi, kullanıcının tarayıcısında: drone stüdyosu (/studio/, apps/drone-studio)
 * ekran dışı bir çerçevede açılır, parsel yüklenir, ~6 sn'lik iniş kare kare çizilip MP4'e kodlanır ve R2'ye yüklenir.
 * GPU sunucusu (RunPod) gerekmez. Çekim form doldurulurken arka planda sürer; olmazsa video yaklaşmasız üretilir.
 */
export type Approach =
  | { status: "working"; progress: number }
  | { status: "done"; key: string }
  | { status: "failed"; error: string };

type Studio = {
  parcel: unknown;
  loadParcel(p: unknown, key: string): Promise<unknown>;
  recordApproach(o: { onProgress?: (d: number, frame: HTMLCanvasElement) => void; signal?: AbortSignal }): Promise<Blob>;
};

async function waitFor<T>(get: () => T | undefined, ms: number): Promise<T> {
  const t0 = Date.now();
  for (;;) {
    const v = get();
    if (v) return v;
    if (Date.now() - t0 > ms) throw new Error("Harita açılamadı");
    await new Promise((r) => setTimeout(r, 200));
  }
}

export function ApproachRecorder({ parcelText, onChange }: { parcelText: string; onChange: (a: Approach) => void }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [state, setState] = useState<Approach>({ status: "working", progress: 0 });
  const [phase, setPhase] = useState("Parsel ve çevre bilgisi hazırlanıyor");
  const [thumb, setThumb] = useState<string>();
  const [video, setVideo] = useState<string>();
  const [run, setRun] = useState(0);
  const report = useRef(onChange);
  report.current = onChange;

  useEffect(() => {
    const ctrl = new AbortController();
    const set = (a: Approach) => {
      if (ctrl.signal.aborted) return;
      setState(a);
      report.current(a);
    };
    set({ status: "working", progress: 0 });
    setThumb(undefined);
    setVideo(undefined);
    (async () => {
      if (typeof VideoEncoder === "undefined") throw new Error("Bu tarayıcı video kodlamayı desteklemiyor (güncel Chrome, Edge ya da Safari gerekir)");
      setPhase("Parsel ve çevre bilgisi hazırlanıyor");
      const res = await fetch("/api/parcel/prepare", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: parcelText }), signal: ctrl.signal });
      const data = (await res.json()) as { parcel?: unknown; key?: string; error?: string };
      if (!res.ok || !data.parcel || !data.key) throw new Error(data.error ?? "Parsel hazırlanamadı");
      setPhase("3D harita yükleniyor");
      const studio = await waitFor(() => (frame.current?.contentWindow as (Window & { studio?: Studio }) | null)?.studio, 30_000);
      await studio.loadParcel(data.parcel, data.key);
      setPhase("Drone çekimi çiziliyor");
      let lastThumb = 0;
      const blob = await studio.recordApproach({
        signal: ctrl.signal,
        onProgress: (d, f) => {
          set({ status: "working", progress: d * 0.95 });
          if (Date.now() - lastThumb > 700) {
            lastThumb = Date.now();
            setThumb(f.toDataURL("image/jpeg", 0.6));
          }
        },
      });
      setPhase("Yükleniyor");
      const fd = new FormData();
      fd.append("file", new File([blob], "yaklasma.mp4", { type: "video/mp4" }));
      const up = await fetch("/api/uploads", { method: "POST", body: fd, signal: ctrl.signal });
      const u = (await up.json()) as { key?: string; error?: string };
      if (!up.ok || !u.key) throw new Error(u.error ?? "Çekim yüklenemedi");
      setVideo(URL.createObjectURL(blob));
      set({ status: "done", key: u.key });
    })().catch((e) => {
      if (ctrl.signal.aborted) return;
      set({ status: "failed", error: e instanceof Error ? e.message : String(e) });
    });
    return () => ctrl.abort();
  }, [parcelText, run]);

  const pct = state.status === "working" ? Math.round(state.progress * 100) : 100;
  return (
    <div className="pnl-kart p-5 sm:p-6">
      {/* Stüdyo 1080×1920 sahneyle çizer; görünmez ama ekran dışında tam boyutta durmalı (WebGL). Her denemede yeniden açılır. */}
      <iframe key={run} ref={frame} src="/studio/index.html?record=1" title="Drone stüdyosu" aria-hidden tabIndex={-1}
        style={{ position: "fixed", left: -12000, top: 0, width: 1080, height: 1920, border: 0, pointerEvents: "none" }} />
      <div className="flex gap-4">
        <div className="relative h-32 w-[72px] shrink-0 overflow-hidden rounded-lg bg-zemin">
          {video ? (
            <video src={video} className="h-full w-full object-cover" autoPlay muted loop playsInline />
          ) : thumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumb} alt="" className="h-full w-full object-cover" />
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-semibold">Drone yaklaşma çekimi</div>
          <p className="mt-1 text-sm text-gri">
            Video, kameranın mahallenin yukarısından arsaya inmesiyle başlar; yakındaki yerler etiketlenir. Çekim bu tarayıcıda hazırlanır.
          </p>
          {state.status === "working" && (
            <>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-zemin">
                <div className="h-full rounded-full bg-gok transition-[width]" style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-2 text-sm text-gri">{phase}… %{pct}. Bitene kadar bu sekmeyi açık tutun.</p>
            </>
          )}
          {state.status === "done" && <p className="mt-3 text-sm font-medium text-cimen-koyu">Çekim hazır</p>}
          {state.status === "failed" && (
            <div className="mt-3 text-sm">
              <p className="text-mercan-koyu">Çekim hazırlanamadı: {state.error}. Video yaklaşmasız, doğrudan arsadan başlar.</p>
              <button type="button" className="mt-1 text-gri underline hover:text-lacivert" onClick={() => setRun((n) => n + 1)}>Yeniden dene</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
