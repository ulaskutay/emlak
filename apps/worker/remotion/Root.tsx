import { Composition } from "remotion";
import { IlanVideo } from "./IlanVideo";
import type { IlanVideoProps } from "./types";

/** Süre ve kare hızı girdiden: zaman çizelgesini worker kurar. */
export function Root() {
  return (
    <Composition
      id="IlanVideo"
      component={IlanVideo}
      width={1080}
      height={1920}
      fps={30}
      durationInFrames={30}
      defaultProps={{ fps: 30, durationInFrames: 30, transition: 12, fontBase: "", scenes: [], outro: { from: 0, frames: 30, transition: "zoom", background: "", priceLabel: "Fiyat" }, audio: { voice: [], whooshAt: [] } } satisfies IlanVideoProps}
      calculateMetadata={({ props }) => ({ durationInFrames: props.durationInFrames, fps: props.fps })}
    />
  );
}
