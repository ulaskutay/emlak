/**
 * Sunuculu ev turunu kuyruk/veritabanı olmadan, yerel fotoğraflarla dener (Higgsfield CLI oturumu açık olmalı).
 *
 *   pnpm --filter @arsa/worker sunucu-dene -- --out <klasör> --room salon=<foto.jpg> --room yatak_odasi=<foto.jpg> [--presenter murat] [--style modern]
 *     [--kind "Kiralık Daire"] [--rooms 2+1] [--m2 89] [--location "Üsküdar Acıbadem"] [--highlight "..."] [--price 109000]
 *     [--agent-name ".."] [--agent-photo foto.jpg] [--logo logo.png] [--office ".."] [--phone ".."] [--no-music]
 */
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { PresenterId, RoomType, StagingStyle } from "@arsa/shared";
import { ffmpeg } from "../src/templates/common.js";
import { presenterTour, type TourRoom } from "../src/templates/sunucu-ev.js";

const { values: a } = parseArgs({
  args: process.argv.slice(2).filter((x) => x !== "--"),
  options: {
    out: { type: "string" },
    room: { type: "string", multiple: true },
    style: { type: "string" },
    presenter: { type: "string", default: "defne" },
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
    "no-music": { type: "boolean" },
  },
});
if (!a.out || !a.room?.length) throw new Error("--out ve en az bir --room oda=foto gerekli");
const workDir = resolve(a.out);
await mkdir(workDir, { recursive: true });

// Fotoğraf dikey (9:16) kırpılır, worker'daki gibi ortadan.
const rooms: TourRoom[] = await Promise.all(
  a.room.map(async (spec, i) => {
    const [room, file] = spec.split("=") as [string, string];
    const out = resolve(workDir, `oda-${i + 1}.jpg`);
    await ffmpeg(["-i", resolve(file), "-vf", "crop=min(iw\\,ih*9/16):min(ih\\,iw*16/9)", "-q:v", "2", out]);
    return { file: out, room: RoomType.parse(room) };
  }),
);

const t0 = Date.now();
const r = await presenterTour(
  { workDir, cacheDir: workDir, log: (m) => console.log(m), stage: async (s, p) => console.log(`aşama ${s} ${p ?? ""}`) },
  rooms,
  {
    presenter: PresenterId.parse(a.presenter),
    style: a.style ? StagingStyle.parse(a.style) : undefined,
    details: {
      kind: a.kind,
      rooms: a.rooms,
      netM2: a.m2 ? Number(a.m2) : undefined,
      location: a.location,
      highlights: a.highlight ?? [],
    },
    priceTry: a.price ? Number(a.price) : undefined,
    music: !a["no-music"],
    agent: { name: a["agent-name"], office: a.office, phone: a.phone, photo: a["agent-photo"] && resolve(a["agent-photo"]), logo: a.logo && resolve(a.logo) },
  },
);
console.log(`${r.videoPath} · ${r.durationSec.toFixed(1)} sn · ${((Date.now() - t0) / 1000).toFixed(0)} sn sürdü`, r.stats);
