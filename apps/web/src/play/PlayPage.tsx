import type { Diagnostic, MineMap, RobotState, RunResult } from "@minescript/engine";
import { useEffect, useMemo, useRef, useState } from "react";
import { PageHeader } from "../components/PageHeader.tsx";
import { Panel } from "../components/Panel.tsx";
import { Link } from "../components/ui/Link.tsx";
import { Segmented } from "../components/ui/Segmented.tsx";
import type { EditorHandle } from "../editor/MineScriptEditor.tsx";
import { hu } from "../i18n/hu.ts";
import type { MapDetail } from "../maps/queries.ts";
import { MineBoard } from "../mine/MineBoard.tsx";
import type { Exploration, FogMode } from "../mine/tiles-model.ts";
import { deriveFrame, type Frame } from "./derive.ts";
import { Gauges, type RunPhase } from "./Gauges.tsx";
import { LiveAnnouncer } from "./LiveAnnouncer.tsx";
import { ProgramPanel, reportFormat } from "./ProgramPanel.tsx";
import { isPlaybackActive, type PlaybackStatus, usePlayback } from "./playback-store.ts";
import "./PlayPage.css";
import { useProgramDraft } from "./program-draft.ts";
import { ConsoleTape, VariablesPanel } from "./Readouts.tsx";
import { RunBanner } from "./RunBanner.tsx";
import { stepDuration, usePrevious } from "./step-animation.ts";
import { TransportDeck } from "./TransportDeck.tsx";
import { usePlaybackTimer } from "./usePlaybackTimer.ts";
import { useRunSession } from "./useRunSession.ts";

type PlayPageProps = { detail: MapDetail; map: MineMap };

const NO_LINES: readonly number[] = [];

function runPhase(status: PlaybackStatus, result: RunResult | null, atEnd: boolean): RunPhase {
  if (status === "finished" && atEnd && result?.outcome.kind === "runtimeError") {
    return "error";
  }
  return status;
}

function finalAnnouncement(status: PlaybackStatus, result: RunResult | null): string | undefined {
  if (status === "stopped") {
    return hu.play.stoppedBody;
  }
  if (status !== "finished" || !result) {
    return undefined;
  }
  return result.outcome.kind === "runtimeError"
    ? hu.play.runtimeErrorTitle(result.outcome.code, result.outcome.line)
    : hu.play.finishedBody(result.gold, result.steps);
}

function isFocusLost(): boolean {
  return document.activeElement === null || document.activeElement === document.body;
}

function useExploration(frame: Frame | null, mode: FogMode): Exploration | null {
  return useMemo(
    () => (frame ? { discovered: frame.discovered, mined: frame.mined, mode } : null),
    [frame, mode],
  );
}

export function PlayPage({ detail, map }: PlayPageProps) {
  const mapId = detail.map.id;
  const start = useMemo<RobotState>(() => ({ pos: map.robot, dir: map.dir }), [map]);
  const [draft, setDraft] = useProgramDraft(mapId);
  const [fogMode, setFogMode] = useState<FogMode>("lamp");
  const editorRef = useRef<EditorHandle>(null);
  const bannerRef = useRef<HTMLDivElement>(null);
  const { result, start: runStart, source: runSource, index, status, speed } = usePlayback();
  const session = useRunSession({
    mapId,
    mapVersionId: detail.version.id,
    mapText: detail.version.content,
    start,
  });
  usePlaybackTimer();
  useEffect(() => () => usePlayback.getState().clear(), []);
  useEffect(() => {
    if ((status === "finished" || status === "stopped") && isFocusLost()) {
      bannerRef.current?.focus();
    }
  }, [status]);

  const frame = useMemo(
    () => (result && runStart ? deriveFrame(result, runStart, index) : null),
    [result, runStart, index],
  );
  const exploration = useExploration(frame, fogMode);
  const previousIndex = usePrevious(index);
  const isLocked = isPlaybackActive(status);
  const isTraceOfEditor = draft.source === runSource;
  const robot = frame?.robot ?? start;

  const errorLines = useMemo(() => {
    if (session.syntaxErrors) {
      return [...new Set(session.syntaxErrors.map((diagnostic) => diagnostic.span.line))];
    }
    if (isTraceOfEditor && frame?.atEnd && result?.outcome.kind === "runtimeError") {
      return [result.outcome.line];
    }
    return NO_LINES;
  }, [session.syntaxErrors, isTraceOfEditor, frame?.atEnd, result]);

  const revealLine = (line: number) => editorRef.current?.revealLine(line);

  const revealDiagnostic = (diagnostic: Diagnostic) =>
    editorRef.current?.reveal(diagnostic.span.from, diagnostic.span.to);

  const sparkle = frame?.lastMined && index > 0 ? { pos: frame.lastMined, key: index } : null;

  return (
    <div className="play-page">
      <PageHeader
        eyebrow={`${hu.play.eyebrow} · ${hu.maps.versionLong(detail.version.version)}`}
        title={detail.map.title}
        lead={detail.map.description || undefined}
        actions={
          <>
            <Link
              to="/leaderboard/$mapId"
              params={{ mapId: String(mapId) }}
              variant="secondary"
              icon="trophy"
            >
              {hu.play.toLeaderboard}
            </Link>
            {detail.canEdit ? (
              <Link
                to="/maps/$mapId/edit"
                params={{ mapId: String(mapId) }}
                variant="ghost"
                icon="pickaxe"
              >
                {hu.play.editMap}
              </Link>
            ) : null}
          </>
        }
      />
      <Gauges
        gold={frame?.gold ?? 0}
        goldTotal={detail.info?.goldTotal ?? 0}
        steps={frame?.steps ?? 0}
        line={frame?.line ?? null}
        robot={robot}
        phase={runPhase(status, result, frame?.atEnd ?? false)}
      />
      <div className="play-console">
        <ProgramPanel
          draft={draft}
          mapTitle={detail.map.title}
          isLocked={isLocked}
          execLine={isTraceOfEditor ? (frame?.line ?? null) : null}
          errorLines={errorLines}
          editorRef={editorRef}
          onDraftChange={(next) => {
            setDraft(next);
            session.clearSyntaxErrors();
          }}
          onRun={() => session.run(draft.source)}
          onReveal={revealDiagnostic}
          onFormatRequest={() => reportFormat(editorRef.current?.format() ?? null)}
        />
        <div className="play-mine">
          <Panel
            title={hu.play.mineHeading}
            tone="screen"
            bodyClassName="play-mine-body"
            actions={
              <Segmented
                label={hu.play.viewLabel}
                isLabelHidden
                value={fogMode}
                onChange={setFogMode}
                options={[
                  { id: "lamp", label: hu.play.viewLamp, icon: "lantern" },
                  { id: "full", label: hu.play.viewFull, icon: "grid" },
                ]}
              />
            }
          >
            <MineBoard
              map={map}
              robot={robot}
              label={hu.play.mapLabel(detail.map.title)}
              exploration={exploration}
              sparkle={sparkle}
              stepMs={stepDuration(previousIndex, index, speed)}
            />
            <p className="play-view-help">{hu.play.viewHelp}</p>
          </Panel>
          <TransportDeck />
          <RunBanner
            ref={bannerRef}
            status={status}
            outcome={result?.outcome ?? null}
            gold={result?.gold ?? 0}
            steps={result?.steps ?? 0}
            syntaxErrors={session.syntaxErrors}
            submission={session.submission}
            onRetry={session.retrySubmit}
            onShowLine={revealLine}
          />
          <div className="play-readouts">
            <ConsoleTape entries={frame?.console ?? []} />
            <VariablesPanel variables={frame?.variables ?? new Map()} />
          </div>
        </div>
      </div>
      <LiveAnnouncer frame={frame} final={finalAnnouncement(status, result)} />
    </div>
  );
}
