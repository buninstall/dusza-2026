import type { MineMap, RobotState } from "@minescript/engine";
import { type CSSProperties, type ReactNode, useEffect, useMemo, useRef } from "react";
import { RegionBoundary } from "../components/RegionBoundary.tsx";
import { hu } from "../i18n/hu.ts";
import { usePrefersReducedMotion } from "../lib/motion.ts";
import { MineBoard } from "../mine/MineBoard.tsx";
import { usePlaybackSounds } from "../sound/usePlaybackSounds.ts";
import { deriveFault } from "./fault.ts";
import { GoldFlight } from "./GoldFlight.tsx";
import { LiveAnnouncer } from "./LiveAnnouncer.tsx";
import { type Blocked, moodFor } from "./phase.ts";
import { usePlayUi } from "./play-ui-store.ts";
import { isScrubbable, usePlayback } from "./playback-store.ts";
import { SplitHandle } from "./SplitHandle.tsx";
import { SheetRunContext } from "./sheet/SheetRun.tsx";
import { useBreakpointNotice } from "./useBreakpointNotice.ts";
import { useWellZoom } from "./useWellZoom.ts";
import "./PlayScreen.css";
import { boardDressing } from "./stage/board-dressing.tsx";
import { ControlDeck } from "./stage/ControlDeck.tsx";
import { HudRail } from "./stage/HudRail.tsx";
import { ConsoleTape, LOG_ID, LogToggle, MemoryTable } from "./stage/LogStrip.tsx";
import { LongRunNotice } from "./stage/LongRunNotice.tsx";
import { ShiftReport } from "./stage/ShiftReport.tsx";
import {
  isTurbo,
  segmentDuration,
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
  bezel: ReactNode;
  sheet: ReactNode;
  reportFooter: ReactNode;
  wellOverlay?: ReactNode;
  onRun: () => boolean;
  onInsertGuard?: ((line: number) => void) | undefined;
  revealLine: (line: number) => void;
  focusEditor: () => void;
  commands: Omit<PlayCommands, "run">;
};

function isFocusLost(): boolean {
  return document.activeElement === null || document.activeElement === document.body;
}

function finalAnnouncement(view: PlayView): string | undefined {
  const result = usePlayback.getState().result;
  if (view.report === "stopped") {
    return hu.play.stoppedBody;
  }
  if (!result || (view.report !== "ok" && view.report !== "error" && view.report !== "limit")) {
    return undefined;
  }
  return result.outcome.kind === "runtimeError"
    ? hu.play.runtimeErrorTitle(result.outcome.code, result.outcome.line)
    : hu.play.finishedBody(result.gold, result.steps);
}

function useStageMotion(map: MineMap, view: PlayView, start: RobotState) {
  const index = usePlayback((state) => state.index);
  const speed = usePlayback((state) => state.speed);
  const runId = usePlayback((state) => state.runId);
  const result = usePlayback((state) => state.result);
  const fogMode = usePlayUi((state) => state.fogMode);
  const previousIndex = usePrevious(index);
  const isReduced = usePrefersReducedMotion();
  const isAdvancing = useStepWindow(`${runId}:${index}`, index === previousIndex + 1);
  const stepMs = isReduced || !isAdvancing ? 0 : stepDuration(previousIndex, index, speed);
  const turbo = isTurbo(speed);
  const frame = view.frame;
  const robot = frame?.robot ?? start;
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
    fogMode,
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
  const wellRef = useRef<HTMLDivElement>(null);
  const status = usePlayback((state) => state.status);
  const result = usePlayback((state) => state.result);
  const runId = usePlayback((state) => state.runId);
  const ui = usePlayUi();
  const motion = useStageMotion(map, view, start);
  usePlaybackTimer();
  usePlaybackSounds();
  useWellZoom(wellRef, motion.robot.pos, layout === "cab");
  useBreakpointNotice();

  useEffect(() => () => usePlayback.getState().clear(), []);
  useEffect(() => {
    if (view.report !== null && isFocusLost()) {
      reportRef.current?.focus();
    }
  }, [view.report]);

  const afterRun = (isStarted: boolean, isFromLever: boolean) => {
    ui.markRun();
    if (isStarted) {
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

  usePlayShortcuts(rootRef, stageRef, { ...props.commands, run: () => run(false) });

  const frame = view.frame;
  const outcome = result?.outcome;
  const urgent =
    frame?.atEnd && outcome?.kind === "runtimeError" && view.report !== null
      ? hu.play.runtimeErrorTitle(outcome.code, outcome.line)
      : undefined;

  const report =
    view.report === null || view.report === "ok" ? null : (
      <ShiftReport
        ref={reportRef}
        kind={view.report}
        result={result}
        blocked={blocked}
        onShowLine={props.revealLine}
      />
    );
  const consoleCount = frame?.console.length ?? 0;

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
          <div
            ref={wellRef}
            className="well-view"
            data-zoomed={ui.zoom > 1}
            style={{ "--zoom": ui.zoom } as CSSProperties}
          >
            <MineBoard
              map={map}
              robot={motion.robot}
              label={hu.play.mapLabel(facts.title)}
              describedBy={facts.description ? facts.descriptionId : undefined}
              exploration={
                frame
                  ? { discovered: frame.discovered, mined: frame.mined, mode: motion.fogMode }
                  : null
              }
              sparkle={motion.sparkle}
              stepMs={motion.stepMs}
              fit="both"
              look={motion.dressing.look}
              overlay={motion.dressing.overlay}
              cellMarks={motion.dressing.cellMarks}
              cellNotes={motion.dressing.cellNotes}
            />
          </div>
          <span aria-hidden="true" key={`flash-${runId}-${view.phase}`} className="stage-flash" />
          <div className="stage-status">
            <LongRunNotice />
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
          onRun={() => run(true)}
          extra={<LogToggle count={consoleCount} isOpen={ui.isLogOpen} onToggle={ui.toggleLog} />}
        />
        {ui.isLogOpen ? (
          <div className="log" id={LOG_ID}>
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
      <SheetRunContext value={mode === "play" ? () => run(false) : null}>
        {props.sheet}
      </SheetRunContext>
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
    <div ref={rootRef} className="play" data-layout={layout} data-mode={mode} style={share}>
      {panes}
      <GoldFlight flight={motion.flight} rootRef={rootRef} />
      <LiveAnnouncer frame={frame} final={finalAnnouncement(view)} urgent={urgent} />
    </div>
  );
}
