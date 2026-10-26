/**
 * Sunucu portreleri: her karakterin Higgsfield Soul kimliğinden (Soul 2.0) bir portre üretir ve panelin
 * karakter seçimindeki küçük resmini (apps/web/public/media/sunucular/<id>.jpg) onunla değiştirir.
 * Komutta cinsiyet ve görünüm tarifi şart: tarifsiz komutta Defne'nin Soul'u erkek üretti (2026-10-26).
 *
 *   pnpm --filter @arsa/worker sunucu-portre [-- defne murat]   (karakter verilmezse hepsi; portre başına 0,12 kredi)
 */
import { spawn } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { HiggsfieldCli } from "@arsa/providers";
import { PRESENTER_IDS, PRESENTERS, PresenterId } from "@arsa/shared";

const OUT = fileURLToPath(new URL("../../web/public/media/sunucular/", import.meta.url));
const ids = process.argv.slice(2).filter((a) => a !== "--").map((a) => PresenterId.parse(a));
const hf = new HiggsfieldCli();
const tmp = await mkdtemp(join(tmpdir(), "sunucu-portre-"));

const ffmpeg = (args: string[]) =>
  new Promise<void>((res, rej) => {
    const p = spawn("ffmpeg", ["-v", "error", "-y", ...args], { stdio: "inherit" });
    p.on("close", (c) => (c === 0 ? res() : rej(new Error(`ffmpeg ${c}`))));
  });

await Promise.all(
  (ids.length ? ids : PRESENTER_IDS).map(async (id) => {
    const p = PRESENTERS[id];
    const prompt =
      `Photorealistic portrait of a Turkish ${p.gender === "female" ? "woman" : "man"} real estate agent, ${p.look}, ` +
      "standing in a bright modern apartment living room, waist-up, facing the camera with a warm confident smile, natural daylight, natural skin texture, no text, no UI.";
    const r = await hf.generate(
      "text2image_soul_v2",
      { params: { prompt, "soul-id": p.soulId, aspect_ratio: "3:4", quality: "1.5k" } },
      { label: p.name, log: console.log },
    );
    const raw = join(tmp, `${id}.png`);
    await writeFile(raw, Buffer.from(await (await fetch(r.url)).arrayBuffer()));
    // Kart oranı 3:4; panelde küçük gösterilir.
    await ffmpeg(["-i", raw, "-vf", "scale=360:-2", "-q:v", "4", join(OUT, `${id}.jpg`)]);
    console.log(`${p.name}: ${join(OUT, `${id}.jpg`)}`);
  }),
);
