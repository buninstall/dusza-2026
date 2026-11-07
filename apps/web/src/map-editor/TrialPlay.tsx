import type { MineMap, RobotState } from "@minescript/engine";
import { useId, useMemo, useRef } from "react";
import { Led } from "../components/Led.tsx";
import { Button } from "../components/ui/Button.tsx";
import type { EditorHandle } from "../editor/MineScriptEditor.tsx";
import { useEngine } from "../engine/useEngine.ts";
import { hu } from "../i18n/hu.ts";
import { PlayScreen } from "../play/PlayScreen.tsx";
import { useProgramDraft } from "../play/program-draft.ts";
import { GUARD_BLOCK } from "../play/sheet/blocks.ts";
import { ProgramSheet } from "../play/sheet/ProgramSheet.tsx";
import { useProgramPersistence } from "../play/sheet/useProgramPersistence.ts";
import { Bezel } from "../play/stage/Bezel.tsx";
import { usePlayView } from "../play/usePlayView.ts";
import { useEngineRun } from "../play/useRunSession.ts";

export const TRIAL_DRAFT_ID = 0;

type TrialPlayProps = { map: MineMap; text: string; title: string; onBack: () => void };

export function TrialPlay({ map, text, title, onBack }: TrialPlayProps) {
  const engine = useEngine();
  const descriptionId = useId();
  const editorRef = useRef<EditorHandle>(null);
  const start = useMemo<RobotState>(() => ({ pos: map.robot, dir: map.dir }), [map]);
  const info = useMemo(() => engine.mapInfo(map), [engine, map]);
  const [draft, setDraft] = useProgramDraft(TRIAL_DRAFT_ID);
  const engineRun = useEngineRun(text, start);
  const view = usePlayView(draft.source, engineRun.blocked, map);
  const onDraftChange = (next: typeof draft) => {
    setDraft(next);
    engineRun.clearBlocked();
  };
  const persistence = useProgramPersistence({ draft, onDraftChange });
  const shownTitle = hu.trial.title(title);

  return (
    <PlayScreen
      mode="play"
      map={map}
      start={start}
      facts={{
        title: shownTitle,
        goldTotal: info.goldTotal,
        reachableGold: info.reachableGold,
        description: undefined,
        descriptionId,
      }}
      view={view}
      blocked={engineRun.blocked}
      attempt={engineRun.attempt}
      editorSource={draft.source}
      bezel={
        <Bezel
          name={hu.trial.sign}
          title={shownTitle}
          meta={hu.trial.note}
          documentTitle={hu.trial.title(title)}
          actions={
            <Button size="sm" icon="arrowLeft" onPress={onBack}>
              {hu.trial.back}
            </Button>
          }
        />
      }
      sheet={
        <ProgramSheet
          draft={draft}
          onDraftChange={onDraftChange}
          persistence={persistence}
          mapTitle={shownTitle}
          editorRef={editorRef}
          isLocked={view.isLocked}
          execLine={view.execLine}
          errorLines={view.errorLines}
          runtimeMark={view.runtimeMark}
        />
      }
      reportFooter={<Led state="off" label={hu.trial.note} isSentenceCase />}
      onRun={() => engineRun.run(draft.source)}
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
