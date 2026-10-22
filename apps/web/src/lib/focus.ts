import "server-only";
import { spawn } from "node:child_process";

/**
 * Dikey (9:16) kırpmanın yatay konumu (0 = sol, 1 = sağ): fotoğrafın en aydınlık dikey şeridi, yani çoğunlukla
 * pencere, kadraja alınır. Yatay ilan fotoğrafının ortadan kırpılması pencereyi dışarıda bırakabiliyordu.
 * Kullanıcı formda değiştirebilir.
 */
export function autoFocus(jpg: Buffer): Promise<number> {
  return new Promise((res) => {
    const out: Buffer[] = [];
    const p = spawn("ffmpeg", ["-v", "error", "-i", "pipe:0", "-vf", "scale=64:-2,format=gray", "-frames:v", "1", "-f", "rawvideo", "pipe:1"]);
    p.stdout.on("data", (d) => out.push(d));
    p.on("error", () => res(0.5));
    p.stdin.on("error", () => {});
    p.on("close", () => {
      const px = Buffer.concat(out);
      const W = 64;
      const H = Math.floor(px.length / W);
      const cw = Math.round((H * 9) / 16);
      if (!H || cw >= W) return res(0.5);
      // Üst %75 (zemin ve halı yansıması hesaba girmesin), sütun sütun parlaklık.
      const col = Array.from({ length: W }, (_, x) => {
        let s = 0;
        for (let y = 0; y < Math.round(H * 0.75); y++) s += px[y * W + x]!;
        return s;
      });
      let best = 0;
      let bestSum = -1;
      for (let x = 0; x + cw <= W; x++) {
        const sum = col.slice(x, x + cw).reduce((a, b) => a + b, 0);
        if (sum > bestSum) [best, bestSum] = [x, sum];
      }
      // Uçlara yapışmasın diye merkeze biraz çekilir.
      res(Math.round((0.5 + (best / (W - cw) - 0.5) * 0.85) * 100) / 100);
    });
    p.stdin.end(jpg);
  });
}
