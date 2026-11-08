import type { MineMap, RobotState } from "@minescript/engine";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useId, useMemo, useRef } from "react";
import { sessionQuery } from "../auth/session.ts";
import { Link } from "../components/ui/Link.tsx";
import type { EditorHandle } from "../editor/MineScriptEditor.tsx";
import { NuggetRow } from "../game/NuggetRow.tsx";
import { RunMedal } from "../game/RunMedal.tsx";
import { hu } from "../i18n/hu.ts";
import type { MapDetail } from "../maps/queries.ts";
import { PixelIcon } from "../pixel/PixelIcon.tsx";
import { TourCoach } from "../tour/TourCoach.tsx";
import { isDarkMine } from "./lamp-mode.ts";
import { isFullViewLocked, type LampSetup, PlayScreen } from "./PlayScreen.tsx";
import { type ProgramDraft, useProgramDraft } from "./program-draft.ts";
import { GUARD_BLOCK } from "./sheet/blocks.ts";
import { ProgramSheet } from "./sheet/ProgramSheet.tsx";
import { useProgramPersistence } from "./sheet/useProgramPersistence.ts";
import { Bezel } from "./stage/Bezel.tsx";
import { SubmissionLine } from "./stage/ShiftReport.tsx";
import { useLampSketch } from "./useLampSketch.ts";
import { usePlayView } from "./usePlayView.ts";
import { useEngineRun, useRunSubmission } from "./useRunSession.ts";

const FULL_STARS = 3;

function DarkMineTag({ mode }: { mode: LampSetup["mode"] }) {
  return (
    <span className="play-dark-tag">
      <PixelIcon name="lantern" />
      {mode === "dark" ? hu.mapEditor.lampDark : hu.mapEditor.lampLamp}
    </span>
  );
}

type PlayPageProps = {
  detail: MapDetail;
  map: MineMap;
  initialDraft?: ProgramDraft | undefined;
  shouldFocusEditor?: boolean;
};

export function PlayPage({ detail, map, initialDraft, shouldFocusEditor = false }: PlayPageProps) {
  const mapId = detail.map.id;
  const descriptionId = useId();
  const start = useMemo<RobotState>(() => ({ pos: map.robot, dir: map.dir }), [map]);
  const [draft, setDraft] = useProgramDraft(mapId, initialDraft);
  const editorRef = useRef<EditorHandle>(null);
  useEffect(() => {
    if (shouldFocusEditor) {
      requestAnimationFrame(() => editorRef.current?.focus());
    }
  }, [shouldFocusEditor]);
  const engineRun = useEngineRun(detail.version.content, start);
  const { submission, retrySubmit } = useRunSubmission({
    mapId,
    mapVersionId: detail.version.id,
  });
  const view = usePlayView(draft.source, engineRun.blocked, map);
  const onDraftChange = (next: ProgramDraft) => {
    setDraft(next);
    engineRun.clearBlocked();
  };
  const persistence = useProgramPersistence({ draft, onDraftChange });
  const userId = useQuery(sessionQuery).data?.id ?? null;
  const lampMode = detail.map.lampMode;
  const sketch = useLampSketch({
    userId,
    mapVersionId: detail.version.id,
    mode: lampMode,
    map,
    start,
  });
  const lamp: LampSetup | undefined = isDarkMine(lampMode)
    ? { mode: lampMode, sketch, canSeeAll: detail.canEdit || detail.player.stars === FULL_STARS }
    : undefined;
  const goldTotal = detail.info?.goldTotal ?? 0;
  const reachableGold = detail.info?.reachableGold ?? goldTotal;

  const bezel = (
    <Bezel
      name={hu.signs.play}
      title={detail.map.title}
      isFullLocked={isFullViewLocked(lamp)}
      meta={
        detail.player.stars === null ? undefined : (
          <span className="play-progress" title={hu.game.starRule(detail.map.parSteps)}>
            {lamp ? <DarkMineTag mode={lamp.mode} /> : null}
            <NuggetRow earned={detail.player.stars} size="sm" />
            {detail.map.parSteps === null ? null : (
              <span>{hu.game.parShort(detail.map.parSteps)}</span>
            )}
          </span>
        )
      }
      actions={
        detail.canEdit ? (
          <Link
            to="/maps/$mapId/edit"
            params={{ mapId: String(mapId) }}
            variant="ghost"
            size="sm"
            icon="pickaxe"
          >
            {hu.play.editMap}
          </Link>
        ) : null
      }
    />
  );

  const run = () => engineRun.run(draft.source);

  return (
    <>
      <PlayScreen
        mode="play"
        map={map}
        start={start}
        facts={{
          title: detail.map.title,
          goldTotal,
          reachableGold,
          description: detail.map.description || undefined,
          descriptionId,
        }}
        view={view}
        blocked={engineRun.blocked}
        attempt={engineRun.attempt}
        editorSource={draft.source}
        bezel={bezel}
        sheet={
          <ProgramSheet
            draft={draft}
            onDraftChange={onDraftChange}
            persistence={persistence}
            mapTitle={detail.map.title}
            editorRef={editorRef}
            isLocked={view.isLocked}
            execLine={view.execLine}
            errorLines={view.errorLines}
            runtimeMark={view.runtimeMark}
          />
        }
        reportFooter={<SubmissionLine submission={submission} onRetry={retrySubmit} />}
        wellOverlay={
          <RunMedal
            mapId={mapId}
            submission={submission}
            reachableGold={reachableGold}
            isDaily={detail.player.isDaily}
          />
        }
        lamp={lamp}
        onRun={run}
        onInsertGuard={(line) => editorRef.current?.insertBeforeLine(line, GUARD_BLOCK)}
        revealLine={(line) => editorRef.current?.revealLine(line)}
        focusEditor={() => editorRef.current?.focus()}
        commands={{
          save: persistence.saveCurrent,
          saveAs: () => persistence.setPanel("saveAs"),
          library: () => persistence.setPanel("library"),
        }}
      />
      <TourCoach
        mapId={mapId}
        source={draft.source}
        onSourceChange={(source) => onDraftChange({ ...draft, source })}
      />
    </>
  );
}
