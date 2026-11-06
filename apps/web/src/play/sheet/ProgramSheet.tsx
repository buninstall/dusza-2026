import type { Diagnostic } from "@minescript/engine";
import { useNavigate } from "@tanstack/react-router";
import { type Ref, type RefObject, useId, useState } from "react";
import { toast } from "../../components/ui/Toast.tsx";
import type { RuntimeMark } from "../../editor/exec-line.ts";
import type { LintReport } from "../../editor/lint.ts";
import { type EditorHandle, MineScriptEditor } from "../../editor/MineScriptEditor.tsx";
import { formatCount, hu } from "../../i18n/hu.ts";
import { downloadText, safeFilename } from "../../lib/files.ts";
import { usePlayUi } from "../play-ui-store.ts";
import type { ProgramDraft } from "../program-draft.ts";
import { decodeProgramFile, PROGRAM_MAX_CHARS } from "../program-file.ts";
import { BlockDrawers } from "./BlockDrawers.tsx";
import type { Block } from "./blocks.ts";
import { FaultBar } from "./FaultBar.tsx";
import { ForemanTip } from "./ForemanTip.tsx";
import { reportFormat } from "./format-report.ts";
import { ProgramLibraryDialog } from "./ProgramLibraryDialog.tsx";
import { DocumentTab, SheetToolbar } from "./SheetToolbar.tsx";
import { type LastRun, pickTip, type TipAction } from "./tips.ts";
import "./Sheet.css";
import type { ProgramPersistence } from "./useProgramPersistence.ts";

type ProgramSheetProps = {
  draft: ProgramDraft;
  onDraftChange: (draft: ProgramDraft) => void;
  persistence: ProgramPersistence;
  mapId: number;
  mapTitle: string;
  reachableGold: number;
  editorRef: RefObject<EditorHandle | null>;
  isLocked: boolean;
  isActive: boolean;
  execLine: number | null;
  errorLines: readonly number[];
  runtimeMark: RuntimeMark | null;
  lastRun: LastRun | null;
  wasRefused: boolean;
  attempt: number;
  ref?: Ref<HTMLElement>;
};

function revealDiagnostic(editor: EditorHandle | null, diagnostic: Diagnostic | undefined) {
  if (diagnostic) {
    editor?.reveal(diagnostic.span.from, diagnostic.span.to);
  }
}

function useSheetDiagnostics() {
  const [report, setReport] = useState<LintReport>({ diagnostics: [], hasFailed: false });
  return { ...report, setReport };
}

export function ProgramSheet(props: ProgramSheetProps) {
  const { draft, onDraftChange, persistence, editorRef, isLocked } = props;
  const helpId = useId();
  const navigate = useNavigate();
  const lint = useSheetDiagnostics();
  const [announcement, setAnnouncement] = useState("");
  const [hiddenAttempt, setHiddenAttempt] = useState(-1);
  const ui = usePlayUi();

  const importFile = async (file: File) => {
    const decoded = decodeProgramFile(await file.arrayBuffer());
    if (!decoded.ok) {
      toast.error(decoded.message);
      return;
    }
    onDraftChange({ source: decoded.text, linked: null });
    toast.success(hu.play.imported(file.name));
  };

  const insert = (block: Block) => {
    const range = editorRef.current?.insertBlock(block);
    if (range) {
      setAnnouncement(hu.blocks.inserted(range.firstLine, range.lastLine));
    }
  };

  const firstError = lint.diagnostics.find((diagnostic) => diagnostic.severity === "error");
  const tip = pickTip({
    isActive: props.isActive,
    diagnostics: lint.diagnostics,
    isEmpty: draft.source.trim().length === 0,
    wasRefused: props.wasRefused,
    isBlockedTipHidden: hiddenAttempt === props.attempt,
    hasRunOnce: ui.hasRunOnce,
    lastRun: props.lastRun,
    reachableGold: props.reachableGold,
    dismissed: ui.dismissedTips,
  });

  const runTip = (action: TipAction) => {
    const editor = editorRef.current;
    const actions: Record<TipAction, () => void> = {
      firstError: () => revealDiagnostic(editor, firstError),
      format: () => reportFormat(editor?.format() ?? null),
      showEmptyBlock: () =>
        revealDiagnostic(
          editor,
          lint.diagnostics.find((diagnostic) => diagnostic.code === "LINT_EMPTY_BLOCK"),
        ),
      openRobot: () => ui.setOpenDrawer("robot"),
      fullMap: () => ui.setFogMode("full"),
      leaderboard: () =>
        void navigate({ to: "/leaderboard/$mapId", params: { mapId: String(props.mapId) } }),
    };
    actions[action]();
  };

  const dismissTip = () => {
    if (tip?.id === "blocked") {
      setHiddenAttempt(props.attempt);
      return;
    }
    if (tip) {
      ui.dismissTip(tip.id);
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
      <DocumentTab draft={draft} isLocked={isLocked} lockText={hu.play.locked} />
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
      {tip ? <ForemanTip key={tip.id} tip={tip} onAction={runTip} onDismiss={dismissTip} /> : null}
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
