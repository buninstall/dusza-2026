import type { RobotState } from "@minescript/engine";
import type { CSSProperties } from "react";
import type { LedBlink, LedState } from "../../components/Led.tsx";
import { hu } from "../../i18n/hu.ts";
import { lampFor, type StagePhase } from "../phase.ts";
import { CartGauge } from "./CartGauge.tsx";
import { Compass } from "./Compass.tsx";
import { DepthGauge } from "./DepthGauge.tsx";
import "./HudRail.css";

const KIT_LED: Record<LedState, string> = {
  off: "off",
  ok: "ok",
  busy: "on",
  warn: "warn",
  error: "err",
};

type LineReadoutProps = {
  line: number | null;
  lineText: string | null;
  onReveal: (line: number) => void;
};

function LineReadout({ line, lineText, onReveal }: LineReadoutProps) {
  return (
    <div className="hud-cell hud-line">
      <span className="hud-label">{hu.play.line}</span>{" "}
      {line === null ? (
        <span className="k-screen hud-screen hud-line-idle">–</span>
      ) : (
        <button
          type="button"
          className="k-screen hud-screen hud-line-button"
          onClick={() => onReveal(line)}
        >
          <span className="visually-hidden">{hu.play.lineJump(line)}</span>
          <span className="hud-line-no" aria-hidden="true">
            {line}.
          </span>
          {lineText === null ? null : <code className="hud-ticker">{lineText.trim()}</code>}
        </button>
      )}
    </div>
  );
}

export type Battery = { radius: number; max: number; isBroken: boolean };

function BatteryMeter({ battery }: { battery: Battery }) {
  const fill = { "--v": battery.max > 0 ? battery.radius / battery.max : 0 } as CSSProperties;
  return (
    <div className="hud-cell hud-battery" data-broken={battery.isBroken}>
      <span className="hud-label" aria-hidden="true">
        {hu.play.battery}
      </span>{" "}
      <span className="visually-hidden">{hu.play.batterySpoken(battery.radius, battery.max)}</span>
      <span
        aria-hidden="true"
        className="k-gauge hud-gauge hud-battery-gauge"
        data-state={battery.isBroken ? "err" : undefined}
        style={fill}
      />
      <span aria-hidden="true" className="hud-of">
        {battery.radius}/{battery.max}
      </span>
    </div>
  );
}

function StatusLamp({ phase }: { phase: StagePhase }) {
  const lamp = lampFor(phase);
  const blink: LedBlink = lamp.blink;
  return (
    <div className="hud-cell hud-status">
      <span className="visually-hidden">{hu.play.status}</span>{" "}
      <span
        aria-hidden="true"
        className="k-led hud-led"
        data-state={KIT_LED[lamp.led]}
        data-blink={blink === false ? undefined : String(blink)}
      />
      <span className="hud-status-text">{lamp.label}</span>
    </div>
  );
}

type HudRailProps = {
  phase: StagePhase;
  gold: number;
  goldTotal: number;
  steps: number;
  line: number | null;
  lineText: string | null;
  robot: RobotState;
  isRolling: boolean;
  isLimit: boolean;
  battery?: Battery | null;
  onRevealLine: (line: number) => void;
};

export function HudRail({
  phase,
  gold,
  goldTotal,
  steps,
  line,
  lineText,
  robot,
  isRolling,
  isLimit,
  battery = null,
  onRevealLine,
}: HudRailProps) {
  return (
    <section aria-label={hu.play.gauges} className="hud k-panel k-panel--inset">
      <StatusLamp phase={phase} /> <CartGauge gold={gold} total={goldTotal} isRolling={isRolling} />{" "}
      <DepthGauge steps={steps} isLimit={isLimit} />{" "}
      {battery ? (
        <>
          <BatteryMeter battery={battery} />{" "}
        </>
      ) : null}
      <Compass robot={robot} />{" "}
      <LineReadout line={line} lineText={lineText} onReveal={onRevealLine} />
    </section>
  );
}
