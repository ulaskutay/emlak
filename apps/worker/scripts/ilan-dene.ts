/**
 * İlan videosunu kuyruk/veritabanı/R2 olmadan, yerel fotoğraflarla dener (seslendirme ve müzik için ELEVENLABS_API_KEY).
 *
 *   pnpm --filter @arsa/worker ilan-dene -- --out <klasör> --photo dis_cephe=<foto.jpg> --photo salon=<foto.jpg> ...
 *     [--kind "Kiralık Daire"] [--rooms 2+1] [--m2 89] [--location "Üsküdar Acıbadem"] [--highlight "..."] [--price 109000]
 *     [--agent-name ".."] [--agent-photo foto.jpg] [--logo logo.png] [--office ".."] [--phone ".."] [--no-voice] [--no-music]
 */
import { createReadStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { RoomType } from "@arsa/shared";
import type { JobContext } from "../src/templates/common.js";
import { ilanVideosu } from "../src/templates/ilan-videosu.js";

const { values: a } = parseArgs({
  args: process.argv.slice(2).filter((x) => x !== "--"),
  options: {
    out: { type: "string" },
    photo: { type: "string", multiple: true },
    kind: { type: "string" },
    rooms: { type: "string" },
    m2: { type: "string" },
    location: { type: "string" },
    highlight: { type: "string", multiple: true },
    price: { type: "string" },
    "agent-name": { type: "string" },
    "agent-photo": { type: "string" },
    logo: { type: "string" },
    office: { type: "string" },
    phone: { type: "string" },
    "no-voice": { type: "boolean" },
    "no-music": { type: "boolean" },
  },
});
if (!a.out || !a.photo?.length) throw new Error("--out ve en az bir --photo oda=foto gerekli");
const workDir = resolve(a.out);
await mkdir(workDir, { recursive: true });

// R2 yerine: anahtar dosyanın mutlak yolu, adresi yerel sunucudan.
const server = createServer((req, res) => createReadStream(decodeURIComponent(new URL(req.url!, "http://x").pathname)).on("error", () => res.writeHead(404).end()).pipe(res));
await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
const r2 = { url: async (key: string) => `${base}${encodeURI(key)}` } as unknown as JobContext["r2"];

const photos = a.photo.map((spec) => {
  const [room, file] = spec.split("=") as [string, string];
  return { key: resolve(file), room: RoomType.parse(room), focusX: 0.5 };
});
const video = {
  id: "deneme",
  template: "ilan-videosu",
  input: {
    photos,
    details: {
      kind: a.kind,
      rooms: a.rooms,
      netM2: a.m2 ? Number(a.m2) : undefined,
      location: a.location,
      highlights: a.highlight ?? [],
    },
    agent: { name: a["agent-name"], photoKey: a["agent-photo"] && resolve(a["agent-photo"]), logoKey: a.logo && resolve(a.logo) },
    voice: !a["no-voice"],
  },
  listing: { priceTry: a.price ? Number(a.price) : undefined, officeName: a.office, phone: a.phone },
  music: !a["no-music"],
  voiceId: null,
} as unknown as JobContext["video"];

const t0 = Date.now();
let last = "";
const r = await ilanVideosu({
  video,
  r2,
  workDir,
  cacheDir: workDir,
  log: (m) => console.log(m),
  stage: async (s, p = 0) => {
    const line = `aşama ${s} ${Math.floor(p * 10) * 10}%`;
    if (line !== last) console.log((last = line));
  },
});
server.close();
console.log(`Video hazır (${((Date.now() - t0) / 1000).toFixed(0)} sn, ${r.durationSec.toFixed(1)} sn): ${r.videoPath}`);
console.log(JSON.stringify(r.stats));
