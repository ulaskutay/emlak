import type { AiScene, CameraMove } from "./storyboard.js";

const CAMERA_PROMPTS: Record<CameraMove, string> = {
  slow_push_in: "The camera performs a smooth, slow cinematic push-in.",
  slow_pull_out: "The camera slowly pulls back, revealing the wider landscape.",
  orbit_left: "The camera slowly orbits to the left with gentle parallax.",
  orbit_right: "The camera slowly orbits to the right with gentle parallax.",
  drone_rise: "Aerial drone shot, the camera rises slowly and steadily.",
  pan_left: "The camera pans slowly to the left.",
  pan_right: "The camera pans slowly to the right.",
};

/**
 * Emlak sahnesi için prompt. Arazinin gerçeğe sadık kalması kritik:
 * yeni yapı/yol/insan eklenmemeli, sadece kamera ve doğal ortam hareketi olmalı.
 */
export function buildRealEstatePrompt(scene: AiScene): { prompt: string; negativePrompt: string } {
  return {
    prompt: [
      scene.prompt,
      CAMERA_PROMPTS[scene.camera],
      "The land, terrain and surroundings stay exactly as in the photo.",
      "Only subtle natural motion: grass and trees swaying gently in the wind, soft moving clouds, natural daylight.",
      "Photorealistic real estate footage, stable, no cuts.",
    ].join(" "),
    negativePrompt:
      "new buildings, construction, houses, roads, people, cars, animals, text, watermark, logo, " +
      "morphing terrain, distortion, flicker, blurry, low quality, cartoon, fast motion, shaky camera",
  };
}
