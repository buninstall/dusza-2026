import { useEffect, useMemo, useState } from "react";
import { hu } from "../i18n/hu.ts";
import { usePrefersReducedMotion } from "../lib/motion.ts";
import { MineBoard } from "../mine/MineBoard.tsx";
import type { Exploration } from "../mine/tiles-model.ts";
import { PixelIcon } from "../pixel/PixelIcon.tsx";
import { PixelText } from "../pixel/PixelText.tsx";
import { deriveFrame } from "../play/derive.ts";
import "./AuthScreen.css";
import { DEMO_MAP, DEMO_PROGRAM, DEMO_RUN, DEMO_START } from "./demo-run.ts";

const STEP_MS = 720;
const HOLD_STEPS = 4;
const SCENE_STEP_ANIMATION_MS = 360;
const CYCLE = DEMO_RUN.events.length + HOLD_STEPS;

function useDemoIndex(isStatic: boolean): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (isStatic) {
      return;
    }
    const timer = window.setInterval(() => setTick((value) => (value + 1) % CYCLE), STEP_MS);
    return () => window.clearInterval(timer);
  }, [isStatic]);
  return isStatic ? DEMO_RUN.events.length : Math.min(tick, DEMO_RUN.events.length);
}

export function AttractScene() {
  const isStatic = usePrefersReducedMotion();
  const index = useDemoIndex(isStatic);
  const frame = useMemo(() => deriveFrame(DEMO_RUN, DEMO_START, index), [index]);
  const exploration = useMemo<Exploration>(
    () => ({ discovered: frame.discovered, mined: frame.mined, mode: "full" }),
    [frame],
  );
  const sparkle = frame.lastMined ? { pos: frame.lastMined, key: frame.index } : null;

  return (
    <figure className="auth-scene" aria-hidden="true" inert>
      <div className="auth-scene-board">
        <MineBoard
          map={DEMO_MAP}
          robot={frame.robot}
          label={hu.auth.sceneCaption}
          exploration={exploration}
          sparkle={sparkle}
          stepMs={isStatic ? 0 : SCENE_STEP_ANIMATION_MS}
          size="scene"
        />
      </div>
      <ol className="auth-scene-program">
        {DEMO_PROGRAM.map((line, position) => (
          <li
            key={line + position.toString()}
            data-current={frame.line === position + 1}
            className="auth-scene-line"
          >
            <span className="auth-scene-marker">
              {frame.line === position + 1 ? <PixelIcon name="play" size="sm" /> : null}
            </span>
            <code>{line}</code>
          </li>
        ))}
      </ol>
      <figcaption className="auth-scene-caption">
        <span className="auth-scene-counter">
          <span className="label">{hu.play.gold}</span>
          <PixelText text={String(frame.gold)} scale={2} className="auth-scene-gold" />
        </span>
        <span className="auth-scene-counter">
          <span className="label">{hu.play.steps}</span>
          <PixelText text={String(frame.steps)} scale={2} />
        </span>
      </figcaption>
    </figure>
  );
}
