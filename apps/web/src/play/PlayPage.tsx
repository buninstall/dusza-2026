import type { MineMap, RobotState } from "@minescript/engine";
import { useEffect, useId, useMemo, useRef } from "react";
import { Link } from "../components/ui/Link.tsx";
import type { EditorHandle } from "../editor/MineScriptEditor.tsx";
import { hu } from "../i18n/hu.ts";
import type { MapDetail } from "../maps/queries.ts";
import { PlayScreen } from "./PlayScreen.tsx";
import { type ProgramDraft, useProgramDraft } from "./program-draft.ts";
import { GUARD_BLOCK } from "./sheet/blocks.ts";
import { ProgramSheet } from "./sheet/ProgramSheet.tsx";
import { useProgramPersistence } from "./sheet/useProgramPersistence.ts";
import { Bezel } from "./stage/Bezel.tsx";
import { SubmissionLine } from "./stage/ShiftReport.tsx";
import { usePlayView } from "./usePlayView.ts";
import { useEngineRun, useRunSubmission } from "./useRunSession.ts";

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
  const view = usePlayView(draft.source, engineRun.blocked);
  const onDraftChange = (next: ProgramDraft) => {
    setDraft(next);
    engineRun.clearBlocked();
  };
  const persistence = useProgramPersistence({ draft, onDraftChange });
  const goldTotal = detail.info?.goldTotal ?? 0;
  const reachableGold = detail.info?.reachableGold ?? goldTotal;

  const bezel = (
    <Bezel
      name={hu.signs.play}
      title={detail.map.title}
      actions={
        <>
          <Link
            to="/leaderboard/$mapId"
            params={{ mapId: String(mapId) }}
            variant="secondary"
            size="sm"
            icon="trophy"
          >
            {hu.play.toLeaderboard}
          </Link>
          {detail.canEdit ? (
            <Link
              to="/maps/$mapId/edit"
              params={{ mapId: String(mapId) }}
              variant="ghost"
              size="sm"
              icon="pickaxe"
            >
              {hu.play.editMap}
            </Link>
          ) : null}
        </>
      }
    />
  );

  const run = () => engineRun.run(draft.source);

  return (
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
  );
}
