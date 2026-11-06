import type { Diagnostic, FormatResult } from "@minescript/engine";
import { type Ref, useId, useState } from "react";
import { FileTrigger } from "react-aria-components";
import { Panel } from "../components/Panel.tsx";
import { Button } from "../components/ui/Button.tsx";
import { toast } from "../components/ui/Toast.tsx";
import { type EditorHandle, MineScriptEditor } from "../editor/MineScriptEditor.tsx";
import { hu } from "../i18n/hu.ts";
import { downloadText, firstFile, safeFilename } from "../lib/files.ts";
import { PixelIcon } from "../pixel/PixelIcon.tsx";
import { DiagnosticsList } from "./DiagnosticsList.tsx";
import { ProgramControls } from "./ProgramLibrary.tsx";
import { isModified, type ProgramDraft } from "./program-draft.ts";
import { decodeProgramFile } from "./program-file.ts";
import "./PlayPage.css";

type ProgramPanelProps = {
  draft: ProgramDraft;
  mapTitle: string;
  isLocked: boolean;
  execLine: number | null;
  errorLines: readonly number[];
  editorRef: Ref<EditorHandle>;
  onDraftChange: (draft: ProgramDraft) => void;
  onRun: () => void;
  onReveal: (diagnostic: Diagnostic) => void;
  onFormatRequest: () => void;
};

export function reportFormat(result: FormatResult | null): void {
  if (result === null) {
    return;
  }
  if (result.diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
    toast.error(hu.play.formatFailed);
    return;
  }
  toast.success(hu.play.formatted);
}

function ProgramStatus({ draft }: { draft: ProgramDraft }) {
  if (draft.linked === null) {
    return <span className="play-program-status">{hu.programs.untitled}</span>;
  }
  return (
    <span className="play-program-status">
      {hu.programs.current(draft.linked.title)}
      {isModified(draft) ? <em className="play-modified">{hu.programs.modified}</em> : null}
    </span>
  );
}

export function ProgramPanel({
  draft,
  mapTitle,
  isLocked,
  execLine,
  errorLines,
  editorRef,
  onDraftChange,
  onRun,
  onReveal,
  onFormatRequest,
}: ProgramPanelProps) {
  const helpId = useId();
  const [diagnostics, setDiagnostics] = useState<Diagnostic[]>([]);

  const importProgram = async (files: FileList | null) => {
    const file = firstFile(files);
    if (!file) {
      return;
    }
    const decoded = decodeProgramFile(await file.arrayBuffer());
    if (!decoded.ok) {
      toast.error(decoded.message);
      return;
    }
    onDraftChange({ source: decoded.text, linked: null });
    toast.success(hu.play.imported(file.name));
  };

  return (
    <Panel
      title={hu.play.programHeading}
      className="play-program"
      bodyClassName="play-program-body"
      actions={
        <Button variant="primary" icon="play" onPress={onRun}>
          {hu.play.run}
        </Button>
      }
    >
      <div className="play-toolbar">
        <ProgramStatus draft={draft} />
        <div className="play-toolbar-buttons">
          <ProgramControls
            draft={draft}
            defaultTitle={mapTitle}
            isLocked={isLocked}
            onDraftChange={onDraftChange}
          />
          <FileTrigger
            acceptedFileTypes={[".ms", ".txt", "text/plain"]}
            onSelect={(files) => void importProgram(files)}
          >
            <Button size="sm" icon="upload" isDisabled={isLocked}>
              {hu.play.importProgram}
            </Button>
          </FileTrigger>
          <Button
            size="sm"
            icon="download"
            onPress={() => downloadText(`${safeFilename(mapTitle)}.ms`, draft.source)}
          >
            {hu.play.exportProgram}
          </Button>
          <Button size="sm" icon="format" isDisabled={isLocked} onPress={onFormatRequest}>
            {hu.play.format}
          </Button>
        </div>
      </div>
      {isLocked ? (
        <p className="play-lock-note">
          <PixelIcon name="lock" size="sm" />
          {hu.play.editorLocked}
        </p>
      ) : null}
      <div className="play-editor-frame">
        <MineScriptEditor
          ref={editorRef}
          value={draft.source}
          onChange={(source) => onDraftChange({ ...draft, source })}
          label={hu.play.editorLabel}
          describedBy={helpId}
          execLine={execLine}
          errorLines={errorLines}
          isReadOnly={isLocked}
          onDiagnostics={setDiagnostics}
          onFormat={reportFormat}
        />
      </div>
      <p id={helpId} className="play-editor-help">
        {hu.play.editorHelp}
      </p>
      <DiagnosticsList diagnostics={diagnostics} onReveal={onReveal} />
    </Panel>
  );
}
