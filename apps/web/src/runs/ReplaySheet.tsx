import { type RefObject, useId } from "react";
import type { RuntimeMark } from "../editor/exec-line.ts";
import { type EditorHandle, MineScriptEditor } from "../editor/MineScriptEditor.tsx";
import { hu } from "../i18n/hu.ts";
import { downloadText, safeFilename } from "../lib/files.ts";
import { PixelIcon } from "../pixel/PixelIcon.tsx";
import { FileMenu, SheetBar } from "../play/sheet/SheetToolbar.tsx";
import "../play/sheet/Sheet.css";

type ReplaySheetProps = {
  source: string;
  mapTitle: string;
  editorRef: RefObject<EditorHandle | null>;
  execLine: number | null;
  runtimeMark: RuntimeMark | null;
};

const NO_LINES: readonly number[] = [];

export function ReplaySheet({
  source,
  mapTitle,
  editorRef,
  execLine,
  runtimeMark,
}: ReplaySheetProps) {
  const helpId = useId();
  return (
    <section id="program" aria-label={hu.play.programHeading} className="sheet" data-mode="replay">
      <SheetBar>
        <FileMenu isLocked onExport={() => downloadText(`${safeFilename(mapTitle)}.ms`, source)} />
      </SheetBar>
      <p className="sheet-tab" data-state="locked">
        <PixelIcon name="lock" size="sm" />
        {hu.play.replayLocked}
      </p>
      <div className="sheet-editor">
        <MineScriptEditor
          ref={editorRef}
          value={source}
          onChange={() => undefined}
          label={hu.play.editorLabel}
          describedBy={helpId}
          execLine={execLine}
          errorLines={NO_LINES}
          runtimeMark={runtimeMark}
          isReadOnly
        />
      </div>
      <p id={helpId} className="visually-hidden">
        {hu.play.editorHelp}
      </p>
    </section>
  );
}
