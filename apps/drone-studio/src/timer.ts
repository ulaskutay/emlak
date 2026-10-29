/**
 * Arka plan sekmesinde kısılmayan zamanlayıcı. Tarayıcı gizli sekmede setTimeout'u saniyede bire, 5 dakikadan sonra
 * dakikada bire indirir ("intensive throttling"); kare kare çizim döngüsü (settle) her karede birkaç kısa bekleme
 * yaptığı için panelde sekme değiştirilince yaklaşma kaydı %1'de takılı kalıyordu (2026-10-29). Web Worker'ın
 * zamanlayıcıları bu kısıtlamaya girmez: bekleme worker'da yapılır, sonuç mesajla döner.
 */
let worker: Worker | null = null;
let seq = 0;
const waiting = new Map<number, () => void>();

function timerWorker(): Worker | null {
  if (worker || typeof Worker === "undefined") return worker;
  try {
    const src = "onmessage = (e) => setTimeout(() => postMessage(e.data.id), e.data.ms);";
    worker = new Worker(URL.createObjectURL(new Blob([src], { type: "text/javascript" })));
    worker.onmessage = (e: MessageEvent<number>) => {
      const f = waiting.get(e.data);
      waiting.delete(e.data);
      f?.();
    };
  } catch {
    worker = null;
  }
  return worker;
}

/** fn'i ms sonra çalıştırır (worker yoksa düz setTimeout). */
export function later(fn: () => void, ms: number) {
  const w = timerWorker();
  if (!w) return void setTimeout(fn, ms);
  const id = ++seq;
  waiting.set(id, fn);
  w.postMessage({ id, ms });
}

export const sleep = (ms: number) => new Promise<void>((r) => later(r, ms));
