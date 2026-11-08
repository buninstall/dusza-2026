import type { MineMap, RobotState } from "@minescript/engine";
import { type CSSProperties, type ReactNode, useEffect, useMemo, useRef } from "react";
import { Notice } from "../components/Notice.tsx";
import { RegionBoundary } from "../components/RegionBoundary.tsx";
import { hu } from "../i18n/hu.ts";
import { usePrefersReducedMotion } from "../lib/motion.ts";
import { addRunWear, useRustWear } from "../lib/rust-wear.ts";
import { useStableCallback } from "../lib/stable-callback.ts";
import { MineScene, type SceneReserve } from "../mine/scene/MineScene.tsx";
import type { Exploration, FogMode } from "../mine/tiles-model.ts";
import { usePlaybackSounds } from "../sound/usePlaybackSounds.ts";
import { deriveFault, isOffMapHit } from "./fault.ts";
import { GoldFlight } from "./GoldFlight.tsx";
import { useGhostRun } from "./ghost-run.ts";
import { LiveAnnouncer } from "./LiveAnnouncer.tsx";
import {
  isDarkMine,
  isLampBroken,
  LAMP_MAX_RADIUS,
  type LampMode,
  type LampView,
  lampTrack,
  lampView,
  type Sketch,
} from "./lamp-mode.ts";
import { type Blocked, moodFor } from "./phase.ts";
import { usePlayUi } from "./play-ui-store.ts";
import { isScrubbable, usePlayback } from "./playback-store.ts";
import { SplitHandle } from "./SplitHandle.tsx";
import { useBreakpointNotice } from "./useBreakpointNotice.ts";
import "./PlayScreen.css";
import { boardDressing } from "./stage/board-dressing.tsx";
import { ControlDeck } from "./stage/ControlDeck.tsx";
import { HudRail } from "./stage/HudRail.tsx";
import { ConsoleTape, LOG_ID, LogToggle, MemoryTable } from "./stage/LogStrip.tsx";
import { LongRunNotice } from "./stage/LongRunNotice.tsx";
import { ShiftReport } from "./stage/ShiftReport.tsx";
import {
  eventBeats,
  isTurbo,
  segmentDuration,
  settleWindow,
  stepDuration,
  usePrevious,
  useStepWindow,
} from "./step-animation.ts";
import "./stage/Stage.css";
import { usePlaybackTimer } from "./usePlaybackTimer.ts";
import { usePlayLayout } from "./usePlayLayout.ts";
import { type PlayCommands, usePlayShortcuts } from "./usePlayShortcuts.ts";
import { lineTextOf, type PlayView } from "./usePlayView.ts";

export const SHEET_ID = "program";

const SCENE_RESERVE: SceneReserve = { share: 0.2, minRem: 8, maxShare: 0.4 };

export type LampSetup = { mode: LampMode; sketch: Sketch; canSeeAll: boolean };

export type MapFacts = {
  title: string;
  goldTotal: number;
  reachableGold: number;
  description?: string | undefined;
  descriptionId: string;
};

type PlayScreenProps = {
  mode: "play" | "replay";
  map: MineMap;
  start: RobotState;
  facts: MapFacts;
  view: PlayView;
  blocked: Blocked | null;
  attempt: number;
  editorSource: string;
  mapText?: string | undefined;
  bezel: ReactNode;
  sheet: ReactNode;
  reportFooter: ReactNode;
  wellOverlay?: ReactNode;
  lamp?: LampSetup | undefined;
  onRun: () => boolean;
  onInsertGuard?: ((line: number) => void) | undefined;
  revealLine: (line: number) => void;
  focusEditor: () => void;
  commands: Omit<PlayCommands, "run">;
};

function isFocusLost(): boolean {
  return document.activeElement === null || document.activeElement === document.body;
}

function finalAnnouncement(view: PlayView, map: MineMap): string | undefined {
  const result = usePlayback.getState().result;
  if (view.report === "stopped") {
    return hu.play.stoppedBody;
  }
  if (!result || (view.report !== "ok" && view.report !== "error" && view.report !== "limit")) {
    return undefined;
  }
  return result.outcome.kind === "runtimeError"
    ? hu.play.runtimeErrorSpoken(result.outcome.code, result.outcome.line, isOffMapHit(result, map))
    : hu.play.finishedBody(result.gold, result.steps);
}

function useConsoleOnFirstPrint(runId: number, printed: number) {
  const openedFor = useRef<number | null>(null);
  useEffect(() => {
    if (printed > 0 && openedFor.current !== runId) {
      openedFor.current = runId;
      usePlayUi.getState().openLog();
    }
  }, [runId, printed]);
}

export function isFullViewLocked(lamp: LampSetup | undefined): boolean {
  return lamp !== undefined && isDarkMine(lamp.mode) && !lamp.canSeeAll;
}

type MineSight = { exploration: Exploration | null; lamp: LampView | null };

function useMineSight(
  map: MineMap,
  start: RobotState,
  frame: PlayView["frame"],
  fogMode: FogMode,
  lamp: LampSetup | undefined,
): MineSight {
  const result = usePlayback((state) => state.result);
  const hasEnded = usePlayback((state) => state.hasEnded);
  const mode = lamp?.mode ?? "open";
  const track = useMemo(
    () => (result && isDarkMine(mode) ? lampTrack(map, start, result, mode) : null),
    [result, map, start, mode],
  );
  if (!lamp || !isDarkMine(mode) || fogMode !== "lamp") {
    return {
      exploration: frame
        ? { discovered: frame.discovered, mined: frame.mined, mode: fogMode }
        : null,
      lamp: null,
    };
  }
  const sight = lampView({
    map,
    start,
    mode,
    sketch: lamp.sketch,
    frame,
    track: frame ? track : null,
    isBroken: result !== null && hasEnded && isLampBroken(result),
  });
  return {
    exploration: {
      discovered: sight.discovered,
      lit: sight.lit,
      mined: frame?.mined ?? new Set(),
      mode: "lamp",
    },
    lamp: sight,
  };
}

function useStageMotion(
  map: MineMap,
  view: PlayView,
  start: RobotState,
  lamp: LampSetup | undefined,
) {
  const index = usePlayback((state) => state.index);
  const speed = usePlayback((state) => state.speed);
  const runId = usePlayback((state) => state.runId);
  const result = usePlayback((state) => state.result);
  const chosenFog = usePlayUi((state) => state.fogMode);
  const fogMode: FogMode = !lamp || isFullViewLocked(lamp) ? "lamp" : chosenFog;
  const previousIndex = usePrevious(index);
  const isReduced = usePrefersReducedMotion();
  const frame = view.frame;
  const plannedMs = isReduced
    ? 0
    : stepDuration(previousIndex, index, speed, eventBeats(frame?.event));
  const isAdvancing = useStepWindow(
    `${runId}:${index}`,
    index === previousIndex + 1,
    settleWindow(plannedMs),
  );
  const stepMs = isAdvancing ? plannedMs : 0;
  const turbo = isTurbo(speed);
  const robot = frame?.robot ?? start;
  const sight = useMineSight(map, start, frame, fogMode, lamp);
  const fault = useMemo(() => (result ? deriveFault(result, map) : null), [result, map]);
  const segmentMs = segmentDuration(frame?.event?.path.length ?? 0, stepMs);
  const dressing = boardDressing(
    {
      map,
      robot,
      frame,
      fault,
      phase: view.phase,
      fogMode,
      isShaded: sight.lamp !== null,
      runId,
      isAdvancing,
      isTurbo: turbo,
      segmentMs,
    },
    moodFor(view.phase),
  );
  const isFlying = isAdvancing && !turbo && !isReduced && frame?.event?.mined != null;
  const flight =
    isFlying && frame?.event?.mined ? { key: `${runId}:${index}`, from: frame.event.mined } : null;
  const sparkle =
    frame?.lastMined && isAdvancing && !turbo ? { pos: frame.lastMined, key: index } : null;
  return {
    robot,
    dressing,
    stepMs,
    sight,
    flight,
    sparkle,
    isRolling: isAdvancing && !isReduced,
  };
}

export function PlayScreen(props: PlayScreenProps) {
  const { mode, map, start, facts, view, blocked } = props;
  const layout = usePlayLayout();
  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLElement>(null);
  const leverRef = useRef<HTMLButtonElement>(null);
  const centerRef = useRef<HTMLButtonElement>(null);
  const reportRef = useRef<HTMLDivElement>(null);
  const status = usePlayback((state) => state.status);
  const result = usePlayback((state) => state.result);
  const runId = usePlayback((state) => state.runId);
  const ui = usePlayUi();
  const motion = useStageMotion(map, view, start, props.lamp);
  const ghost = useGhostRun(
    props.editorSource,
    props.mapText,
    start,
    !view.isLocked && !view.isTraceOfEditor && !isFullViewLocked(props.lamp),
  );
  const lampSight = motion.sight.lamp;
  usePlaybackTimer();
  usePlaybackSounds();
  useBreakpointNotice();
  useRustWear(rootRef);

  useEffect(() => () => usePlayback.getState().clear(), []);
  useEffect(() => {
    if (view.report !== null && isFocusLost()) {
      reportRef.current?.focus();
    }
  }, [view.report]);

  const afterRun = (isStarted: boolean, isFromLever: boolean) => {
    ui.markRun();
    if (isStarted) {
      addRunWear();
      if (layout === "panes") {
        stageRef.current?.scrollIntoView({ block: "start" });
      }
      if (isFromLever) {
        requestAnimationFrame(() => centerRef.current?.focus());
      }
      return;
    }
    ui.setFaultBarOpen(true);
  };

  const run = (isFromLever: boolean) => afterRun(props.onRun(), isFromLever);
  const runFromLever = useStableCallback(() => run(true));

  usePlayShortcuts(rootRef, stageRef, { ...props.commands, run: () => run(false) });

  const frame = view.frame;

  const report =
    view.report === null || view.report === "ok" ? null : (
      <ShiftReport
        ref={reportRef}
        kind={view.report}
        result={result}
        blocked={blocked}
        isOffMap={isOffMapHit(result, map)}
        onShowLine={props.revealLine}
      />
    );
  const consoleCount = frame?.console.length ?? 0;
  useConsoleOnFirstPrint(runId, consoleCount);

  const stage = (
    <RegionBoundary key="stage" message={hu.play.stageFailed}>
      <section
        ref={stageRef}
        aria-label={hu.play.paneStage}
        className="stage"
        data-phase={view.phase}
        data-layout={layout}
      >
        {props.bezel}
        <HudRail
          phase={view.phase}
          gold={frame?.gold ?? 0}
          goldTotal={facts.goldTotal}
          steps={frame?.steps ?? 0}
          line={frame?.line ?? null}
          lineText={lineTextOf(usePlayback.getState().source, frame?.line ?? null)}
          robot={motion.robot}
          isRolling={motion.isRolling}
          isLimit={view.phase === "limit"}
          battery={
            lampSight
              ? { radius: lampSight.radius, max: LAMP_MAX_RADIUS, isBroken: lampSight.isBroken }
              : null
          }
          onRevealLine={props.revealLine}
        />
        <div
          className="stage-well"
          style={{ "--rows": map.rows, "--cols": map.cols } as CSSProperties}
        >
          {facts.description ? (
            <p id={facts.descriptionId} className="visually-hidden">
              {facts.description}
            </p>
          ) : null}
          <MineScene
            lighting={props.lamp?.mode ?? "open"}
            zoom={ui.zoom}
            onZoomChange={ui.setZoom}
            {...(layout === "cab" ? { reserve: SCENE_RESERVE } : {})}
            ghost={ghost}
            isWheelZoom={layout === "cab"}
            map={map}
            robot={motion.robot}
            label={hu.play.mapLabel(facts.title)}
            describedBy={facts.description ? facts.descriptionId : undefined}
            exploration={motion.sight.exploration}
            shade={lampSight ? { radius: lampSight.radius, isBroken: lampSight.isBroken } : null}
            sparkle={motion.sparkle}
            stepMs={motion.stepMs}
            look={motion.dressing.look}
            overlay={motion.dressing.overlay}
            cellMarks={motion.dressing.cellMarks}
            cellNotes={motion.dressing.cellNotes}
          />
          {ghost ? (
            <p className="ghost-chip k-screen" data-error={ghost.isError}>
              <span className="ghost-chip-label">{hu.play.ghostLabel}</span>
              <span>{hu.play.ghostSummary(ghost.gold, facts.goldTotal, ghost.steps)}</span>
              {ghost.errorLine !== null ? <span>{hu.play.ghostError(ghost.errorLine)}</span> : null}
            </p>
          ) : null}
          <span aria-hidden="true" key={`flash-${runId}-${view.phase}`} className="stage-flash" />
          <div className="stage-status">
            <LongRunNotice />
            {lampSight?.isBroken ? (
              <Notice tone="warning" title={hu.play.lampBrokenTitle} live="status">
                {hu.play.lampBrokenBody}
              </Notice>
            ) : null}
            {report}
            {view.report === "stopped" || blocked ? null : props.reportFooter}
            {props.wellOverlay}
          </div>
        </div>
        <ControlDeck
          mode={mode}
          layout="cab"
          leverRef={leverRef}
          centerRef={centerRef}
          shakeKey={blocked ? props.attempt : null}
          onRun={runFromLever}
          extra={<LogToggle count={consoleCount} isOpen={ui.isLogOpen} onToggle={ui.toggleLog} />}
        />
        {ui.isLogOpen ? (
          <div className="log k-panel k-panel--inset" id={LOG_ID}>
            <ConsoleTape
              entries={frame?.console ?? []}
              canSeek={isScrubbable(status)}
              onSeek={(index) => usePlayback.getState().seek(index)}
            />
            <MemoryTable
              variables={frame?.variables ?? new Map()}
              changed={frame?.changedVar ?? null}
            />
          </div>
        ) : null}
      </section>
    </RegionBoundary>
  );

  const sheet = (
    <RegionBoundary key="sheet" message={hu.play.sheetFailed}>
      {props.sheet}
    </RegionBoundary>
  );
  const skip = (
    <button
      key="skip"
      type="button"
      className="play-skip"
      onClick={() => requestAnimationFrame(props.focusEditor)}
    >
      {hu.play.toProgram}
    </button>
  );
  const panes =
    layout === "cab"
      ? [sheet, <SplitHandle key="split" containerRef={rootRef} controls={SHEET_ID} />, stage]
      : [skip, stage, sheet];
  const share =
    layout === "cab" && ui.sheetShare !== null
      ? ({ "--sheet-share": `${ui.sheetShare}%` } as CSSProperties)
      : undefined;

  return (
    <div
      ref={rootRef}
      className="play"
      data-layout={layout}
      data-mode={mode}
      data-theme="tarna"
      data-skin="akna"
      style={share}
    >
      {panes}
      <GoldFlight flight={motion.flight} rootRef={rootRef} />
      <LiveAnnouncer frame={frame} final={finalAnnouncement(view, map)} />
    </div>
  );
}
