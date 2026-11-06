import type { CSSProperties } from "react";
import { LOGO_MARK, WORDMARK_ART } from "./logo-art.ts";
import "./pixel.css";
import { PixelSprite } from "./SpriteLayers.tsx";

export type LogoScale = 2 | 4 | 6;
export type LampMood = "steady" | "idle" | "broken" | "pulse";

type LogoProps = { scale?: LogoScale; lamp?: LampMood; isMarkOnly?: boolean };

const LAMP_CLASS: Record<Exclude<LampMood, "steady">, string> = {
  idle: "px-lamp-idle",
  broken: "px-lamp-broken",
  pulse: "px-lamp-pulse",
};

export function LogoMark({ scale = 2, lamp = "steady" }: Omit<LogoProps, "isMarkOnly">) {
  const animated = lamp === "steady" ? undefined : { lamp: LAMP_CLASS[lamp] };
  return (
    <span className="px-logo-mark" style={{ "--logo-scale": scale } as CSSProperties}>
      <PixelSprite sprite={LOGO_MARK} {...(animated ? { animated } : {})} />
    </span>
  );
}

export function Logo({ scale = 2, lamp = "steady", isMarkOnly = false }: LogoProps) {
  return (
    <span className="px-logo" style={{ "--logo-scale": scale } as CSSProperties}>
      <LogoMark scale={scale} lamp={lamp} />
      {isMarkOnly ? null : <PixelSprite sprite={WORDMARK_ART} className="px-wordmark" />}
    </span>
  );
}
