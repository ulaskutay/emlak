"use client";
import { useEffect, useRef, useState } from "react";

/**
 * İnşaat videosunun drone yaklaşma çekimi, üretim sırasında video sayfasında, kullanıcının tarayıcısında: drone
 * stüdyosu (/studio/, apps/drone-studio) ekran dışı bir çerçevede açılır, parsel yüklenir, ~6 sn'lik iniş kare kare
 * çizilip MP4'e kodlanır, R2'ye yüklenip videoya bağlanır (/api/videos/[id]/approach). GPU sunucusu (RunPod) gerekmez.
 * Sunucu bu sırada inşaat kliplerini üretir; bitince çekimi bekler (sayfa açık ve ilerleme geliyorsa), gelmezse
 * video yaklaşmasız çıkar.
 */
type Approach =
  | { status: "working"; progress: number }
  | { status: "done" }
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

export function ApproachRecorder({ videoId }: { videoId: string }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [state, setState] = useState<Approach>({ status: "working", progress: 0 });
  const [phase, setPhase] = useState("Parsel ve çevre bilgisi hazırlanıyor");
  const [thumb, setThumb] = useState<string>();
  const [video, setVideo] = useState<string>();
  const [run, setRun] = useState(0);

  useEffect(() => {
    const ctrl = new AbortController();
    const api = `/api/videos/${videoId}/approach`;
    const post = (body: object) =>
      fetch(api, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    // İlerleme sunucuya birkaç saniyede bir: worker sayfanın açık olduğunu ve çekimin sürdüğünü buradan bilir.
    let lastPost = 0;
    const set = (a: Approach) => {
      if (ctrl.signal.aborted) return;
      setState(a);
      if (a.status === "working" && Date.now() - lastPost > 3000) {
        lastPost = Date.now();
        post({ progress: a.progress });
      }
    };
    set({ status: "working", progress: 0 });
    setThumb(undefined);
    setVideo(undefined);
    (async () => {
      if (typeof VideoEncoder === "undefined") throw new Error("Bu tarayıcı video kodlamayı desteklemiyor (güncel Chrome, Edge ya da Safari gerekir)");
      setPhase("Parsel ve çevre bilgisi hazırlanıyor");
      const res = await fetch(api, { signal: ctrl.signal });
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
      const done = await fetch(api, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: u.key }) });
      if (!done.ok) throw new Error(((await done.json().catch(() => ({}))) as { error?: string }).error ?? "Çekim videoya eklenemedi");
      setVideo(URL.createObjectURL(blob));
      set({ status: "done" });
    })().catch((e) => {
      if (ctrl.signal.aborted) return;
      const error = e instanceof Error ? e.message : String(e);
      set({ status: "failed", error });
      post({ failed: error });
    });
    return () => ctrl.abort();
  }, [videoId, run]);

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
            Video, kameranın mahallenin yukarısından arsaya inmesiyle başlar; yakındaki yerler etiketlenir. Çekim bu tarayıcıda,
            inşaat sahneleri sunucuda hazırlanırken çizilir.
          </p>
          {state.status === "working" && (
            <>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-zemin">
                <div className="h-full rounded-full bg-gok transition-[width]" style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-2 text-sm text-gri">{phase}… %{pct}. Bitene kadar bu sayfayı kapatmayın.</p>
            </>
          )}
          {state.status === "done" && <p className="mt-3 text-sm font-medium text-cimen-koyu">Çekim hazır; videonun başına eklenecek</p>}
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
