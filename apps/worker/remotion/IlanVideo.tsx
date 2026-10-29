/**
 * Fotoğraftan ilan videosu (1080×1920): her fotoğraf yavaş kamera hareketiyle akar, sahneler kayarak/büyüyerek geçer,
 * ilk sahnede ilanın kimliği, sonrakilerde oda başlığı, sonda fiyat ve emlakçı kartı. Ses: seslendirme, anlatımda
 * kısılan müzik ve geçişlerde whoosh.
 *
 * Sahne i, [from − TRANSITION, from + frames) aralığında görünür; sonraki sahne üstüne girerken bu sahne çıkışını oynar.
 */
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import {
  AbsoluteFill,
  continueRender,
  delayRender,
  Easing,
  Html5Audio,
  Img,
  interpolate,
  Sequence,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { IlanScene, IlanVideoProps, Transition } from "./types";

const W = 1080;
const H = 1920;
const GOLD = "#ffc24d";
const INK = "#121a16";
const DISPLAY = "Bricolage Grotesque";
const SANS = "Instrument Sans";
/** Yazılar Reels arayüzünün (üstte başlık, altta açıklama/düğmeler) dışında kalır. */
const SAFE_BOTTOM = 420;

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const smooth = Easing.bezier(0.45, 0, 0.55, 1);
const out = Easing.bezier(0.16, 1, 0.3, 1);

function useFonts(base: string) {
  const [handle] = useState(() => delayRender("yazı tipleri"));
  useEffect(() => {
    const faces = [
      new FontFace(DISPLAY, `url(${base}BricolageGrotesque-ExtraBold.ttf)`, { weight: "800" }),
      new FontFace(DISPLAY, `url(${base}BricolageGrotesque-Bold.ttf)`, { weight: "700" }),
      new FontFace(SANS, `url(${base}InstrumentSans-Regular.ttf)`, { weight: "400" }),
      new FontFace(SANS, `url(${base}InstrumentSans-SemiBold.ttf)`, { weight: "600" }),
    ];
    Promise.all(faces.map((f) => f.load().then((l) => document.fonts.add(l)))).then(() => continueRender(handle), () => continueRender(handle));
  }, [base, handle]);
}

/** Fotoğrafı kadrajı dolduracak boyda, hareketin t (0..1) anındaki konumuyla çizer. */
function KenBurns({ scene, t }: { scene: Pick<IlanScene, "src" | "width" | "height" | "focusX" | "move">; t: number }) {
  const cover = Math.max(W / scene.width, H / scene.height);
  const e = smooth(t);
  const zoom = { push: [1.0, 1.16], pull: [1.16, 1.02], panRight: [1.06, 1.1], panLeft: [1.1, 1.06] }[scene.move];
  const z = interpolate(e, [0, 1], zoom);
  const dw = scene.width * cover * z;
  const dh = scene.height * cover * z;
  // Kaydırmada odak çevresinde ±%22, diğerlerinde odak sabit; kenar asla kadraja girmez (0..1 arası).
  const span = 0.22;
  const px =
    scene.move === "panRight"
      ? interpolate(e, [0, 1], [scene.focusX - span, scene.focusX + span])
      : scene.move === "panLeft"
        ? interpolate(e, [0, 1], [scene.focusX + span, scene.focusX - span])
        : scene.focusX;
  const x = (W - dw) * Math.min(1, Math.max(0, px));
  const y = (H - dh) * interpolate(e, [0, 1], [0.48, 0.52]);
  return <Img src={scene.src} style={{ position: "absolute", left: x, top: y, width: dw, height: dh, maxWidth: "none" }} />;
}

/** Giriş (p: 0→1) ve çıkış (q: 0→1) geçişinin stili. */
function transitionStyle(enter: Transition | null, p: number, exit: Transition | null, q: number): CSSProperties {
  const s: CSSProperties = {};
  const tf: string[] = [];
  if (enter && p < 1) {
    const e = out(p);
    if (enter === "slide") tf.push(`translateX(${(1 - e) * 100}%)`);
    if (enter === "rise") tf.push(`translateY(${(1 - e) * 100}%)`);
    if (enter === "zoom") (tf.push(`scale(${interpolate(e, [0, 1], [1.35, 1])})`), (s.opacity = Math.min(1, p * 2.2)));
    if (enter === "iris") s.clipPath = `circle(${e * 80}% at 50% 50%)`;
  }
  if (exit && q > 0) {
    const e = Easing.in(Easing.cubic)(q);
    if (exit === "slide") tf.push(`translateX(${-e * 35}%)`);
    if (exit === "rise") tf.push(`translateY(${-e * 30}%)`);
    if (exit === "zoom") tf.push(`scale(${1 + e * 0.12})`);
    if (exit === "iris") s.filter = `brightness(${1 - e * 0.45})`;
  }
  if (tf.length) s.transform = tf.join(" ");
  return s;
}

/** Sahnenin kendi Sequence'ı içinde: giriş ve çıkış geçişini uygular. */
function SceneFrame({ enter, exit, frames, T, children }: { enter: Transition | null; exit: Transition | null; frames: number; T: number; children: ReactNode }) {
  const f = useCurrentFrame();
  const p = enter ? interpolate(f, [0, T], [0, 1], clamp) : 1;
  const q = exit ? interpolate(f, [frames - T, frames], [0, 1], clamp) : 0;
  return <AbsoluteFill style={{ overflow: "hidden", ...transitionStyle(enter, p, exit, q) }}>{children}</AbsoluteFill>;
}

/** Alttan maskeyle yükselen satır. */
function Reveal({ delay, children, style }: { delay: number; children: ReactNode; style?: CSSProperties }) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: f - delay, fps, config: { damping: 200, mass: 0.7 } });
  return (
    <div style={{ overflow: "hidden", paddingBottom: 8, ...style }}>
      <div style={{ transform: `translateY(${(1 - s) * 110}%)`, opacity: s }}>{children}</div>
    </div>
  );
}

const shade: CSSProperties = {
  background: `linear-gradient(to top, rgba(10,14,12,0.78) 0%, rgba(10,14,12,0.45) 30%, rgba(10,14,12,0) 52%),
               linear-gradient(to bottom, rgba(10,14,12,0.35) 0%, rgba(10,14,12,0) 16%)`,
};

const titleStyle: CSSProperties = {
  fontFamily: DISPLAY,
  fontWeight: 800,
  fontSize: 104,
  lineHeight: 1.02,
  letterSpacing: "-0.03em",
  color: "white",
  textShadow: "0 4px 30px rgba(0,0,0,0.35)",
};

/** Sahne başlığı: altın sıra numarası ve büyük oda adı; sahne bitmeden söner. */
function SceneTitle({ index, total, title, start, frames }: { index: number; total: number; title: string; start: number; frames: number }) {
  const f = useCurrentFrame();
  const fade = interpolate(f, [frames - 14, frames - 4], [1, 0], clamp);
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", padding: `0 84px ${SAFE_BOTTOM}px`, opacity: fade }}>
      <Reveal delay={start}>
        <div style={{ display: "flex", alignItems: "center", gap: 20, fontFamily: SANS, fontWeight: 600, fontSize: 34, letterSpacing: "0.18em", color: GOLD }}>
          <span>{String(index + 1).padStart(2, "0")}</span>
          <span style={{ width: interpolate(f - start, [0, 18], [0, 90], { ...clamp, easing: out }), height: 3, background: GOLD, borderRadius: 2 }} />
          <span style={{ color: "rgba(255,255,255,0.75)" }}>{String(total).padStart(2, "0")}</span>
        </div>
      </Reveal>
      <Reveal delay={start + 4}>
        <div style={titleStyle}>{title}</div>
      </Reveal>
    </AbsoluteFill>
  );
}

/** İlk sahne: ilanın tipi, konumu ve künyesi. */
function Intro({ intro, start, frames, fallback }: { intro: NonNullable<IlanVideoProps["intro"]>; start: number; frames: number; fallback?: string }) {
  const f = useCurrentFrame();
  const fade = interpolate(f, [frames - 14, frames - 4], [1, 0], clamp);
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", padding: `0 84px ${SAFE_BOTTOM}px`, opacity: fade }}>
      {intro.kind && (
        <Reveal delay={start}>
          <span style={{ display: "inline-block", background: GOLD, color: INK, fontFamily: SANS, fontWeight: 600, fontSize: 36, letterSpacing: "0.14em", padding: "12px 26px", borderRadius: 999 }}>
            {intro.kind.toLocaleUpperCase("tr")}
          </span>
        </Reveal>
      )}
      <Reveal delay={start + 5} style={{ marginTop: 22 }}>
        <div style={titleStyle}>{intro.location ?? fallback ?? ""}</div>
      </Reveal>
      {intro.facts.length > 0 && (
        <Reveal delay={start + 10} style={{ marginTop: 14 }}>
          <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 44, color: "rgba(255,255,255,0.92)" }}>{intro.facts.join("  ·  ")}</div>
        </Reveal>
      )}
    </AbsoluteFill>
  );
}

function PhoneIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z" />
    </svg>
  );
}

/** Kapanış: son fotoğrafın bulanık hali üstünde fiyat, emlakçı, telefon ve logo; parçalar sırayla gelir. */
function Outro({ o, T }: { o: IlanVideoProps["outro"]; T: number }) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = (d: number) => spring({ frame: f - T - d, fps, config: { damping: 14, mass: 0.8 } });
  const zoom = interpolate(f, [0, o.frames + T], [1.25, 1.12]);
  const item = (d: number): CSSProperties => ({ opacity: Math.min(1, pop(d) * 1.4), transform: `translateY(${(1 - pop(d)) * 60}px)` });
  return (
    <AbsoluteFill style={{ background: INK }}>
      <Img src={o.background} style={{ position: "absolute", inset: 0, width: W, height: H, objectFit: "cover", filter: "blur(28px) saturate(1.1)", transform: `scale(${zoom})` }} />
      <AbsoluteFill style={{ background: "rgba(14,20,17,0.62)" }} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", paddingBottom: 140, textAlign: "center" }}>
        {o.price && (
          <>
            <div style={{ ...item(0), fontFamily: SANS, fontWeight: 600, fontSize: 34, letterSpacing: "0.32em", color: "rgba(255,255,255,0.8)" }}>
              {o.priceLabel.toLocaleUpperCase("tr")}
            </div>
            <div style={{ ...item(3), fontFamily: DISPLAY, fontWeight: 800, fontSize: o.price.length > 14 ? 112 : 136, letterSpacing: "-0.03em", color: GOLD, marginTop: 6 }}>
              {o.price}
            </div>
          </>
        )}
        {o.photo && (
          <Img src={o.photo} style={{ ...item(9), marginTop: o.price ? 70 : 0, width: 250, height: 250, borderRadius: "50%", objectFit: "cover", border: `8px solid ${GOLD}` }} />
        )}
        {o.name && <div style={{ ...item(12), fontFamily: DISPLAY, fontWeight: 700, fontSize: 64, color: "white", marginTop: 30 }}>{o.name}</div>}
        {o.office && <div style={{ ...item(14), fontFamily: SANS, fontSize: 40, color: "rgba(255,255,255,0.85)", marginTop: 8 }}>{o.office}</div>}
        {o.phone && (
          <div style={{ ...item(18), marginTop: 48, display: "flex", alignItems: "center", gap: 18, background: GOLD, color: INK, padding: "26px 48px", borderRadius: 999, fontFamily: DISPLAY, fontWeight: 800, fontSize: 56 }}>
            <PhoneIcon />
            {o.phone}
          </div>
        )}
        {!o.phone && !o.price && <div style={{ ...item(4), fontFamily: DISPLAY, fontWeight: 800, fontSize: 96, color: "white" }}>Hemen arayın</div>}
      </AbsoluteFill>
      {o.logo && (
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "flex-end", paddingBottom: SAFE_BOTTOM - 140 }}>
          <div style={{ ...item(22), background: "white", borderRadius: 24, padding: "18px 30px" }}>
            <Img src={o.logo} style={{ height: 130, width: "auto", display: "block" }} />
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
}

/** Altyazı kenarı: kontur harfleri kalınlaştırıp birbirine yapıştırıyordu; çevresel gölgelerle ince, net kenar. */
const OUTLINE = [
  ...Array.from({ length: 16 }, (_, i) => {
    const a = (i / 16) * Math.PI * 2;
    return `${(Math.cos(a) * 5).toFixed(1)}px ${(Math.sin(a) * 5).toFixed(1)}px 0 rgba(10,14,12,0.95)`;
  }),
  "0 8px 28px rgba(0,0,0,0.5)",
].join(", ");

type Words = IlanVideoProps["audio"]["voice"][number]["words"];

/** Kelimeleri en fazla 3'lük parçalara böler; cümle sonu ve virgülde parça biter. */
function chunks(words: Words) {
  const out: Words[] = [];
  let cur: Words = [];
  for (const w of words) {
    cur.push(w);
    if (cur.length === 3 || /[.,!?;:]$/.test(w.text)) (out.push(cur), (cur = []));
  }
  if (cur.length) out.push(cur);
  return out;
}

/** Kelime kelime altyazı: parça belirerek gelir, o an söylenen kelime altın renkte. Kareler anlatımın başına göre. */
function Captions({ words }: { words: Words }) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const parts = chunks(words);
  const k = parts.findIndex((c, i) => f >= c[0]!.start && f < (parts[i + 1]?.[0]!.start ?? c[c.length - 1]!.end + 8));
  if (k < 0) return null;
  const part = parts[k]!;
  const pop = spring({ frame: f - part[0]!.start, fps, config: { damping: 14, mass: 0.5 } });
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "flex-start", padding: "690px 70px 0" }}>
      <div
        style={{
          transform: `scale(${interpolate(pop, [0, 1], [0.82, 1])})`,
          opacity: Math.min(1, pop * 1.6),
          textAlign: "center",
          fontFamily: DISPLAY,
          fontWeight: 800,
          fontSize: 78,
          lineHeight: 1.12,
          letterSpacing: "-0.01em",
          textShadow: OUTLINE,
        }}
      >
        {part.map((w, i) => (
          <span key={i} style={{ color: f >= w.start && f < w.end + 2 ? GOLD : "white" }}>
            {w.text.replace(/[.,!?;:]+$/, "").toLocaleUpperCase("tr")}
            {i < part.length - 1 ? " " : ""}
          </span>
        ))}
      </div>
    </AbsoluteFill>
  );
}

/** Müzik: başta açılır, sonda kısılır, anlatım sırasında yumuşakça kısılır. */
function musicVolume(f: number, total: number, voice: IlanVideoProps["audio"]["voice"]) {
  const base = 0.5 * interpolate(f, [0, 15, total - 45, total], [0, 1, 1, 0], clamp);
  const duck = voice.reduce((m, v) => Math.max(m, interpolate(f, [v.from - 8, v.from, v.from + v.frames, v.from + v.frames + 12], [0, 1, 1, 0], clamp)), 0);
  return base * (1 - 0.68 * duck);
}

export function IlanVideo(props: IlanVideoProps) {
  useFonts(props.fontBase);
  const { scenes, outro, audio, transition: T, durationInFrames } = props;
  const n = scenes.length;
  return (
    <AbsoluteFill style={{ background: INK }}>
      {scenes.map((s, i) => {
        const start = i === 0 ? 0 : s.from - T;
        const frames = s.from + s.frames - start;
        const exit = i < n - 1 ? scenes[i + 1]!.transition : outro.transition;
        const textAt = i === 0 ? 6 : T + 2;
        return (
          <Sequence key={i} from={start} durationInFrames={frames}>
            <SceneFrame enter={i === 0 ? null : s.transition} exit={exit} frames={frames} T={T}>
              <SceneMotion scene={s} frames={frames} />
              <AbsoluteFill style={shade} />
              {i === 0 && props.intro ? (
                <Intro intro={props.intro} start={textAt} frames={frames} fallback={s.title} />
              ) : (
                s.title && <SceneTitle index={i} total={n} title={s.title} start={textAt} frames={frames} />
              )}
            </SceneFrame>
          </Sequence>
        );
      })}
      <Sequence from={outro.from - T} durationInFrames={outro.frames + T}>
        <SceneFrame enter={outro.transition} exit={null} frames={outro.frames + T} T={T}>
          <Outro o={outro} T={T} />
        </SceneFrame>
      </Sequence>

      {/* Kapanış kartında fiyat zaten yazılı: altyazı yalnız sahnelerde. */}
      {audio.voice.filter((v) => v.from < outro.from).map((v, i) => (
        <Sequence key={`c${i}`} from={v.from} durationInFrames={v.frames + 10}>
          <Captions words={v.words} />
        </Sequence>
      ))}

      {audio.music && <Html5Audio src={audio.music} volume={(f) => musicVolume(f, durationInFrames, audio.voice)} />}
      {audio.voice.map((v, i) => (
        <Sequence key={`v${i}`} from={v.from} durationInFrames={v.frames + 6}>
          <Html5Audio src={v.src} volume={1} />
        </Sequence>
      ))}
      {audio.whoosh &&
        audio.whooshAt.map((at, i) => (
          <Sequence key={`w${i}`} from={Math.max(0, at - 10)} durationInFrames={30}>
            <Html5Audio src={audio.whoosh!} volume={0.35} />
          </Sequence>
        ))}
    </AbsoluteFill>
  );
}

function SceneMotion({ scene, frames }: { scene: IlanScene; frames: number }) {
  const f = useCurrentFrame();
  return <KenBurns scene={scene} t={interpolate(f, [0, frames], [0, 1], clamp)} />;
}
