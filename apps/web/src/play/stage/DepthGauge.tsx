import type { CSSProperties } from "react";
import { hu } from "../../i18n/hu.ts";
import { PixelText } from "../../pixel/PixelText.tsx";

export const STEP_LIMIT = 1000;
const SEGMENTS = 20;
const WARN_AT = 750;
const DANGER_AT = 900;

export function depthTone(steps: number): "calm" | "warn" | "danger" {
  if (steps >= DANGER_AT) {
    return "danger";
  }
  return steps >= WARN_AT ? "warn" : "calm";
}

type DepthGaugeProps = { steps: number; isLimit: boolean };

export function DepthGauge({ steps, isLimit }: DepthGaugeProps) {
  const filled = Math.ceil((Math.min(steps, STEP_LIMIT) / STEP_LIMIT) * SEGMENTS);
  const meter = { "--segments": SEGMENTS } as CSSProperties;
  return (
    <div className="hud-gauge hud-depth" data-tone={depthTone(steps)} data-limit={isLimit}>
      <span className="label">{hu.play.steps}</span>{" "}
      <span className="hud-value">
        <PixelText text={String(steps)} scale={3} />
        <span className="visually-hidden">
          {steps} {hu.play.stepsLimit(STEP_LIMIT)}
        </span>
        <span aria-hidden="true" className="hud-of">
          <PixelText text={`/${STEP_LIMIT}`} scale={2} />
        </span>
      </span>{" "}
      <span aria-hidden="true" className="hud-meter" style={meter}>
        {Array.from({ length: SEGMENTS }, (_, segment) => (
          <span key={`s${segment.toString()}`} data-on={segment < filled} />
        ))}
      </span>
    </div>
  );
}
