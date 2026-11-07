import { type CSSProperties, memo, type ReactNode, type Ref, useEffect, useRef } from "react";
import { Button } from "../../components/ui/Button.tsx";
import { Slider } from "../../components/ui/Slider.tsx";
import { hu } from "../../i18n/hu.ts";
import { playOnce, usePrefersReducedMotion } from "../../lib/motion.ts";
import { HazardStripe } from "../../pixel/HazardStripe.tsx";
import { timelineMarks } from "../derive.ts";
import {
  isLiveRun,
  isScrubbable,
  SPEED_STEPS,
  speedAt,
  speedIndex,
  usePlayback,
} from "../playback-store.ts";
import { DeckKeys } from "./DeckKeys.tsx";
import "./ControlDeck.css";

function TimelineMarks() {
  const result = usePlayback((state) => state.result);
  if (!result || result.events.length === 0) {
    return null;
  }
  const total = result.events.length;
  const end = result.outcome.kind === "runtimeError" ? "error" : "ok";
  return (
    <span aria-hidden="true" className="deck-marks">
      {timelineMarks(result).map((mark) => (
        <span
          key={`${mark.kind}-${mark.index.toString()}`}
          data-kind={mark.kind}
          style={{ "--at": mark.index / total } as CSSProperties}
        />
      ))}
      <span data-kind={end} style={{ "--at": 1 } as CSSProperties} />
    </span>
  );
}

export const Timeline = memo(function Timeline() {
  const index = usePlayback((state) => state.index);
  const status = usePlayback((state) => state.status);
  const total = usePlayback((state) => state.result?.events.length ?? 0);
  return (
    <Slider
      label={hu.play.timeline}
      className="deck-timeline"
      minValue={0}
      maxValue={Math.max(total, 1)}
      value={index}
      isDisabled={!isScrubbable(status)}
      onChange={usePlayback.getState().seek}
      format={(value) => hu.play.timelineValue(value, total)}
      decor={<TimelineMarks />}
    />
  );
});

export const TempoGate = memo(function TempoGate() {
  const speed = usePlayback((state) => state.speed);
  return (
    <Slider
      label={hu.play.speed}
      className="deck-tempo"
      minValue={0}
      maxValue={SPEED_STEPS.length - 1}
      step={1}
      value={speedIndex(speed)}
      onChange={(value) => usePlayback.getState().setSpeed(speedAt(value))}
      format={(value) => hu.play.speedValue(speedAt(value))}
      keyShortcuts="+ -"
      decor={
        <span aria-hidden="true" className="deck-detents">
          {SPEED_STEPS.map((step) => (
            <span key={step} />
          ))}
        </span>
      }
    />
  );
});

type LeverProps = {
  mode: "play" | "replay";
  leverRef: Ref<HTMLButtonElement>;
  shakeKey: number | null;
  onRun: () => void;
};

const SHAKE = [0, -4, 4, -2, 0].map((x) => ({ transform: `translateX(${x}px)` }));
const SHAKE_MS = 200;

function useShake(shakeKey: number | null) {
  const housing = useRef<HTMLSpanElement>(null);
  const isReduced = usePrefersReducedMotion();
  useEffect(() => {
    if (shakeKey === null || isReduced) {
      return;
    }
    return playOnce(housing.current, SHAKE, { duration: SHAKE_MS, easing: "steps(1, end)" });
  }, [shakeKey, isReduced]);
  return housing;
}

export const Lever = memo(function Lever({ mode, leverRef, shakeKey, onRun }: LeverProps) {
  const status = usePlayback((state) => state.status);
  const hasEnded = usePlayback((state) => state.hasEnded);
  const isLive = isLiveRun(status, hasEnded);
  const housing = useShake(shakeKey);
  return (
    <span ref={housing} className="deck-lever" data-live={isLive}>
      {isLive ? (
        <Button
          ref={leverRef}
          variant="danger"
          icon="stop"
          aria-keyshortcuts="Shift+F5"
          onPress={usePlayback.getState().stop}
        >
          {hu.play.stop}
        </Button>
      ) : (
        <Button
          ref={leverRef}
          variant="primary"
          icon="play"
          aria-keyshortcuts="Control+Enter F5"
          onPress={onRun}
        >
          {mode === "replay" ? hu.play.replayPlay : hu.play.run}
        </Button>
      )}
      {isLive ? <HazardStripe className="deck-lever-hazard" /> : null}
    </span>
  );
});

type ControlDeckProps = {
  mode: "play" | "replay";
  layout: "cab" | "panes";
  leverRef: Ref<HTMLButtonElement>;
  centerRef: Ref<HTMLButtonElement>;
  shakeKey: number | null;
  onRun: () => void;
  extra?: ReactNode;
};

export function ControlDeck({
  mode,
  layout,
  leverRef,
  centerRef,
  shakeKey,
  onRun,
  extra,
}: ControlDeckProps) {
  return (
    <section aria-label={hu.play.transport} className="deck" data-layout={layout}>
      {layout === "cab" ? (
        <>
          <DeckKeys centerRef={centerRef} />
          <Timeline />
          <TempoGate />
          {extra ? <div className="deck-extra">{extra}</div> : null}
          <Lever mode={mode} leverRef={leverRef} shakeKey={shakeKey} onRun={onRun} />
        </>
      ) : (
        <>
          <Lever mode={mode} leverRef={leverRef} shakeKey={shakeKey} onRun={onRun} />
          <DeckKeys centerRef={centerRef} />
          {extra ? <div className="deck-extra">{extra}</div> : null}
        </>
      )}
    </section>
  );
}
