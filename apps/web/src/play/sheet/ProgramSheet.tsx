import type { Diagnostic } from "@minescript/engine";
import { type Ref, type RefObject, useEffect, useId, useState } from "react";
import { toast } from "../../components/ui/Toast.tsx";
import type { RuntimeMark } from "../../editor/exec-line.ts";
import type { LintReport } from "../../editor/lint.ts";
import { type EditorHandle, MineScriptEditor } from "../../editor/MineScriptEditor.tsx";
import { useEngine } from "../../engine/useEngine.ts";
import { formatCount, hu } from "../../i18n/hu.ts";
import { downloadText, safeFilename } from "../../lib/files.ts";
import { usePlayUi } from "../play-ui-store.ts";
import { usePlayback } from "../playback-store.ts";
import type { ProgramDraft } from "../program-draft.ts";
import { decodeProgramFile, PROGRAM_MAX_CHARS } from "../program-file.ts";
import { BlockDrawers } from "./BlockDrawers.tsx";
import type { Block } from "./blocks.ts";
import { FaultBar } from "./FaultBar.tsx";
import { reportFormat } from "./format-report.ts";
import { ProgramLibraryDialog } from "./ProgramLibraryDialog.tsx";
import { SheetToolbar } from "./SheetToolbar.tsx";
import "./Sheet.css";
import type { ProgramPersistence } from "./useProgramPersistence.ts";

type ProgramSheetProps = {
  draft: ProgramDraft;
  onDraftChange: (draft: ProgramDraft) => void;
  persistence: ProgramPersistence;
  mapTitle: string;
  editorRef: RefObject<EditorHandle | null>;
  isLocked: boolean;
  execLine: number | null;
  errorLines: readonly number[];
  runtimeMark: RuntimeMark | null;
  ref?: Ref<HTMLElement>;
};

function revealDiagnostic(editor: EditorHandle | null, diagnostic: Diagnostic | undefined) {
  if (diagnostic) {
    editor?.reveal(diagnostic.span.from, diagnostic.span.to);
  }
}

function returnFocusAfterMenu(focus: () => void): void {
  requestAnimationFrame(() => requestAnimationFrame(focus));
}

function useSheetDiagnostics() {
  const [report, setReport] = useState<LintReport>({ diagnostics: [], hasFailed: false });
  return { ...report, setReport };
}

export function ProgramSheet(props: ProgramSheetProps) {
  const { draft, onDraftChange, persistence, editorRef, isLocked } = props;
  const helpId = useId();
  const lint = useSheetDiagnostics();
  const [announcement, setAnnouncement] = useState("");
  const ui = usePlayUi();
  const engine = useEngine();
  useEffect(() => {
    usePlayback.getState().setBreakpoints([]);
    return () => usePlayback.getState().setBreakpoints([]);
  }, []);

  const reportImportErrors = (source: string) => {
    const errors = engine
      .analyze(source)
      .diagnostics.filter((diagnostic) => diagnostic.severity === "error");
    const first = errors[0];
    if (first) {
      toast.error(hu.play.importHasErrors(errors.length, first.span.line));
    }
  };

  const importFile = async (file: File) => {
    const decoded = decodeProgramFile(await file.arrayBuffer());
    if (!decoded.ok) {
      toast.error(decoded.message);
      return;
    }
    onDraftChange({ source: decoded.text, linked: null });
    toast.success(hu.play.imported(file.name));
    reportImportErrors(decoded.text);
  };

  const insert = (block: Block) => {
    const range = editorRef.current?.insertBlock(block);
    if (range) {
      setAnnouncement(hu.blocks.inserted(range.firstLine, range.lastLine));
      returnFocusAfterMenu(() => editorRef.current?.focus());
    }
  };

  return (
    <section id="program" ref={props.ref} aria-label={hu.play.programHeading} className="sheet">
      <SheetToolbar
        isLocked={isLocked}
        isSaving={persistence.isSaving}
        onImport={(file) => void importFile(file)}
        onExport={() => downloadText(`${safeFilename(props.mapTitle)}.ms`, draft.source)}
        onSaveAs={() => persistence.setPanel("saveAs")}
        onOpenLibrary={() => persistence.setPanel("library")}
        onFormat={() => reportFormat(editorRef.current?.format() ?? null)}
        onSave={persistence.saveCurrent}
      />
      <BlockDrawers isDisabled={isLocked} onInsert={insert} />
      <div className="sheet-editor">
        <MineScriptEditor
          ref={editorRef}
          value={draft.source}
          onChange={(source) => onDraftChange({ ...draft, source })}
          label={hu.play.editorLabel}
          describedBy={helpId}
          placeholder={hu.play.placeholder}
          execLine={props.execLine}
          errorLines={props.errorLines}
          runtimeMark={props.runtimeMark}
          isReadOnly={isLocked}
          onLint={lint.setReport}
          onFormat={reportFormat}
          onBreakpointsChange={(lines) => usePlayback.getState().setBreakpoints(lines)}
          onBreakpointKey={(line, isSet) =>
            setAnnouncement(isSet ? hu.breakpoints.added(line) : hu.breakpoints.removed(line))
          }
          commands={{ onToggleFaults: () => ui.setFaultBarOpen(!ui.isFaultBarOpen) }}
        />
      </div>
      <p id={helpId} className="visually-hidden">
        {hu.play.editorHelp}
      </p>
      {draft.source.length > PROGRAM_MAX_CHARS ? (
        <p role="alert" className="sheet-limit">
          {hu.play.tooLong(formatCount(draft.source.length), formatCount(PROGRAM_MAX_CHARS))}
        </p>
      ) : null}
      <FaultBar
        diagnostics={lint.diagnostics}
        hasAnalyzerFailed={lint.hasFailed}
        isOpen={ui.isFaultBarOpen}
        onOpenChange={ui.setFaultBarOpen}
        onReveal={(diagnostic) => revealDiagnostic(editorRef.current, diagnostic)}
        onFix={(diagnostic) => {
          const fix = diagnostic.fixes[0];
          if (fix) {
            editorRef.current?.applyEdits(fix.edits);
          }
        }}
      />
      <output className="visually-hidden">{announcement}</output>
      <ProgramLibraryDialog
        draft={draft}
        defaultTitle={props.mapTitle}
        isLocked={isLocked}
        persistence={persistence}
      />
    </section>
  );
}
