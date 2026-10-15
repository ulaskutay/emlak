import type { AiScene, CameraMove } from "./storyboard.js";

/**
 * Sinematik kamera tarifleri. Hunyuan 1.5 kısa komutlardan çok, hareketin hızını, yönünü ve
 * paralaksı anlatan ayrıntılı tariflerle daha akıcı ve tutarlı hareket üretiyor.
 */
const CAMERA_PROMPTS: Record<CameraMove, string> = {
  slow_push_in:
    "Smooth gimbal dolly shot moving slowly forward at a constant speed, the subject gradually filling more of the frame, steady horizon.",
  slow_pull_out:
    "Smooth gimbal dolly shot moving slowly backward at a constant speed, gradually revealing more of the surroundings, steady horizon.",
  orbit_left:
    "Slow cinematic arc shot, the camera glides in a gentle curve to the left around the subject, foreground and background separating with natural parallax.",
  orbit_right:
    "Slow cinematic arc shot, the camera glides in a gentle curve to the right around the subject, foreground and background separating with natural parallax.",
  drone_rise:
    "Aerial drone shot, the camera rises slowly and tilts down gently, revealing the property from a higher vantage point with smooth stabilized motion.",
  pan_left: "Slow steady lateral tracking shot gliding to the left, smooth stabilized motion with subtle parallax.",
  pan_right: "Slow steady lateral tracking shot gliding to the right, smooth stabilized motion with subtle parallax.",
};

/**
 * Emlak sahnesi için prompt.
 *
 * Model CFG'siz çalıştığı için negatif prompt kullanılmıyor; "yeni bina ekleme" gibi olumsuz
 * cümleler pozitif prompt'a yazılınca modeli tam da o nesnelere yönlendirebiliyor. Bu yüzden
 * gerçeğe sadakat yalnızca olumlu ifadelerle (mimari sabit, düzen aynı) anlatılır.
 */
export function buildRealEstatePrompt(scene: AiScene): { prompt: string; negativePrompt: string } {
  const interior = scene.setting === "interior";
  return {
    prompt: [
      scene.prompt,
      CAMERA_PROMPTS[scene.camera],
      interior
        ? "The architecture, materials and room layout remain perfectly static and identical to the photo; only the camera moves."
        : "The architecture, garden layout and landscape remain perfectly static and identical to the photo; only the camera moves.",
      interior
        ? "Soft natural daylight streams through the windows, light reflections glide gently across the glossy surfaces."
        : "Leaves and grass sway gently in a light breeze, soft clouds drift slowly across the sky.",
      "Shot on a cinema camera, 24mm lens, sharp focus, rich true-to-life colors, high dynamic range, " +
        "luxury real estate commercial, photorealistic, smooth and stable, one continuous shot.",
    ].join(" "),
    negativePrompt:
      "morphing, warping, distortion, flicker, blurry, low quality, cartoon, fast motion, shaky camera, extra objects",
  };
}
