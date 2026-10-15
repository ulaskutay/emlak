import "server-only";
import { buildStory } from "@arsa/drone-studio/story";
import type { summarizeParcel } from "./parcel";

/** Ses örneği için parselin kanca cümlesi (çevre bilgisi beklenmeden: yer + büyüklük + nitelik). */
export function hookText(p: ReturnType<typeof summarizeParcel>) {
  const story = buildStory({
    ...p.geo,
    properties: p.properties,
    areaM2: p.summary.areaM2,
    elevation: null,
    address: {},
    pois: [],
  });
  return story.scenes[0]!.text;
}
