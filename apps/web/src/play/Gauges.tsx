import type { RobotState } from "@minescript/engine";
import type { CSSProperties, ReactNode } from "react";
import { Led, type LedState } from "../components/Led.tsx";
import { dirNames, hu } from "../i18n/hu.ts";
import type { IconName } from "../pixel/icons.ts";
import { PixelIcon } from "../pixel/PixelIcon.tsx";
import { PixelSprite } from "../pixel/SpriteLayers.tsx";
import { TILE_SPRITES } from "../pixel/tiles.ts";
import "./PlayPage.css";

export const STEP_LIMIT = 1000;
const METER_SEGMENTS = 20;

const DIR_ICON: Record<RobotState["dir"], IconName> = {
  north: "arrowUp",
  east: "arrowRight",
  south: "arrowDown",
  west: "arrowLeft",
};

export type RunPhase = "idle" | "playing" | "paused" | "finished" | "stopped" | "error";

const PHASE: Record<RunPhase, { led: LedState; label: string }> = {
  idle: { led: "off", label: hu.play.statusIdle },
  playing: { led: "busy", label: hu.play.statusPlaying },
  paused: { led: "warn", label: hu.play.statusPaused },
  finished: { led: "ok", label: hu.play.statusFinished },
  stopped: { led: "off", label: hu.play.statusStopped },
  error: { led: "error", label: hu.play.statusError },
};

function Gauge({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className="play-gauge" data-wide={wide ?? false}>
      <dt className="play-gauge-label">{label}</dt>
      <dd className="play-gauge-value">{children}</dd>
    </div>
  );
}

function StepMeter({ steps }: { steps: number }) {
  const filled = Math.ceil((Math.min(steps, STEP_LIMIT) / STEP_LIMIT) * METER_SEGMENTS);
  const meter = { "--filled": filled, "--segments": METER_SEGMENTS } as CSSProperties;
  return (
    <span
      className="play-meter"
      style={meter}
      aria-hidden="true"
      data-hot={steps > STEP_LIMIT * 0.9}
    >
      {Array.from({ length: METER_SEGMENTS }, (_, segment) => (
        <span key={`s${segment.toString()}`} data-on={segment < filled} />
      ))}
    </span>
  );
}

type GaugesProps = {
  gold: number;
  goldTotal: number;
  steps: number;
  line: number | null;
  robot: RobotState;
  phase: RunPhase;
};

export function Gauges({ gold, goldTotal, steps, line, robot, phase }: GaugesProps) {
  const status = PHASE[phase];
  return (
    <section aria-labelledby="gauges-title" className="play-gauges">
      <h2 id="gauges-title" className="visually-hidden">
        {hu.play.gauges}
      </h2>
      <dl className="play-gauge-list">
        <Gauge label={hu.play.gold}>
          <PixelSprite sprite={TILE_SPRITES.gold} className="play-gauge-sprite" />
          <span className="play-big">{gold}</span>
          <span className="play-small">/ {goldTotal}</span>
        </Gauge>
        <Gauge label={hu.play.steps} wide>
          <span className="play-big">{steps}</span>
          <span className="play-small">{hu.play.stepsLimit(STEP_LIMIT)}</span>
          <StepMeter steps={steps} />
        </Gauge>
        <Gauge label={hu.play.line}>
          <span className="play-big">{line === null ? "–" : line}</span>
        </Gauge>
        <Gauge label={hu.play.position}>
          <span className="play-big">
            {hu.play.positionValue(robot.pos.row + 1, robot.pos.col + 1)}
          </span>
          <span className="play-direction">
            <PixelIcon name={DIR_ICON[robot.dir]} size="sm" />
            {dirNames[robot.dir]}
          </span>
        </Gauge>
        <Gauge label={hu.play.status}>
          <Led state={status.led} label={status.label} isBlinking={phase === "playing"} />
        </Gauge>
      </dl>
    </section>
  );
}
