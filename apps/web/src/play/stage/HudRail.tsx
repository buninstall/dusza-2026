import type { RobotState } from "@minescript/engine";
import { Led } from "../../components/Led.tsx";
import { hu } from "../../i18n/hu.ts";
import { PixelText } from "../../pixel/PixelText.tsx";
import { lampFor, type StagePhase } from "../phase.ts";
import { CartGauge } from "./CartGauge.tsx";
import { Compass } from "./Compass.tsx";
import { DepthGauge } from "./DepthGauge.tsx";
import "./HudRail.css";

type LineReadoutProps = {
  line: number | null;
  lineText: string | null;
  onReveal: (line: number) => void;
};

function LineReadout({ line, lineText, onReveal }: LineReadoutProps) {
  return (
    <div className="hud-gauge hud-line">
      <span className="label">{hu.play.line}</span>
      {line === null ? (
        <span className="hud-value hud-line-idle">–</span>
      ) : (
        <button
          type="button"
          className="hud-line-button"
          aria-label={hu.play.lineButton(line)}
          onClick={() => onReveal(line)}
        >
          <PixelText text={String(line)} scale={3} />
          <span className="visually-hidden">{line}</span>
        </button>
      )}
      {line !== null && lineText !== null ? (
        <code className="hud-ticker" aria-hidden="true">
          {`${line}: ${lineText.trim()}`}
        </code>
      ) : null}
    </div>
  );
}

type HudRailProps = {
  phase: StagePhase;
  gold: number;
  goldTotal: number;
  reachableGold: number;
  steps: number;
  line: number | null;
  lineText: string | null;
  robot: RobotState;
  isRolling: boolean;
  isLimit: boolean;
  onRevealLine: (line: number) => void;
};

export function HudRail({
  phase,
  gold,
  goldTotal,
  reachableGold,
  steps,
  line,
  lineText,
  robot,
  isRolling,
  isLimit,
  onRevealLine,
}: HudRailProps) {
  const lamp = lampFor(phase);
  return (
    <section aria-label={hu.play.gauges} className="hud">
      <div className="hud-gauge hud-lamp">
        <span className="visually-hidden">{hu.play.status}</span>
        <Led state={lamp.led} label={lamp.label} isBlinking={lamp.blink} />
      </div>
      <CartGauge gold={gold} total={goldTotal} reachable={reachableGold} isRolling={isRolling} />
      <DepthGauge steps={steps} isLimit={isLimit} />
      <LineReadout line={line} lineText={lineText} onReveal={onRevealLine} />
      <Compass robot={robot} />
    </section>
  );
}
