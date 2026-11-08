import type { CSSProperties } from "react";
import { hu } from "../../i18n/hu.ts";
import { Odometer } from "./Odometer.tsx";

export const STEP_LIMIT = 1000;
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
  const tone = depthTone(steps);
  const fill = { "--v": Math.min(steps, STEP_LIMIT) / STEP_LIMIT } as CSSProperties;
  return (
    <div className="hud-cell hud-depth" data-tone={tone} data-limit={isLimit}>
      <span className="hud-label">{hu.play.steps}</span>{" "}
      <span className="visually-hidden">
        {steps} {hu.play.stepsLimit(STEP_LIMIT)}
      </span>
      <Odometer value={steps} digits={String(STEP_LIMIT).length} />
      <span
        aria-hidden="true"
        className="k-gauge hud-gauge"
        data-state={isLimit || tone === "danger" ? "err" : undefined}
        style={fill}
      />
      <span aria-hidden="true" className="hud-of">
        /{STEP_LIMIT}
      </span>
    </div>
  );
}
