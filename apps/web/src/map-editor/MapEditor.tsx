import type { Diagnostic, Dir, Pos } from "@minescript/engine";
import { type ReactNode, useId, useMemo, useState } from "react";
import { Panel } from "../components/Panel.tsx";
import { Button } from "../components/ui/Button.tsx";
import { NumberField } from "../components/ui/NumberField.tsx";
import { toast } from "../components/ui/Toast.tsx";
import { useEngine } from "../engine/useEngine.ts";
import { hu } from "../i18n/hu.ts";
import { downloadText, firstFile, safeFilename } from "../lib/files.ts";
import { MineBoard } from "../mine/MineBoard.tsx";
import {
  DetailsFields,
  FileControls,
  type MapDetails,
  ValidationReadout,
  type VersionInfo,
  VersionNote,
} from "./EditorPanels.tsx";
import {
  type DraftMap,
  draftFromMap,
  draftGrid,
  draftRobot,
  draftToText,
  MAX_SIZE,
  MIN_SIZE,
  paint,
  resizeDraft,
  type Tool,
  toolForKey,
  turnRobot,
} from "./editor-state.ts";
import "./MapEditor.css";
import { parseMapFile } from "./map-file.ts";
import { DirectionPad, TOOL_LABEL, ToolRack } from "./ToolRack.tsx";

export type MapFormValues = MapDetails & { content: string };

type MapEditorProps = {
  initialDraft: DraftMap;
  initialDetails: MapDetails;
  version?: VersionInfo | null;
  onSave: (values: MapFormValues) => Promise<void>;
  dangerZone?: ReactNode;
};

type ImportError = { message: string; diagnostics: readonly Diagnostic[] };

function splitDiagnostics(diagnostics: readonly Diagnostic[]) {
  return {
    errors: diagnostics.filter((diagnostic) => diagnostic.severity === "error"),
    warnings: diagnostics.filter((diagnostic) => diagnostic.severity !== "error"),
  };
}

export function MapEditor({
  initialDraft,
  initialDetails,
  version = null,
  onSave,
  dangerZone,
}: MapEditorProps) {
  const engine = useEngine();
  const helpId = useId();
  const [draft, setDraft] = useState(initialDraft);
  const [details, setDetails] = useState(initialDetails);
  const [tool, setTool] = useState<Tool>("wall");
  const [announcement, setAnnouncement] = useState("");
  const [importError, setImportError] = useState<ImportError | null>(null);
  const [isSaving, setSaving] = useState(false);

  const text = useMemo(() => draftToText(draft), [draft]);
  const parsed = useMemo(() => engine.parseMap(text), [engine, text]);
  const { errors, warnings } = splitDiagnostics(parsed.diagnostics);
  const isTitleMissing = details.title.trim().length === 0;
  const canSave = parsed.map !== null && !isTitleMissing;

  const handlePaint = (pos: Pos) => {
    setDraft((current) => paint(current, pos, tool, current.dir));
    setAnnouncement(hu.mapEditor.painted(TOOL_LABEL[tool], pos.row + 1, pos.col + 1));
  };

  const handleShortcut = (key: string) => {
    const next = toolForKey(key);
    if (next) {
      setTool(next);
      setAnnouncement(TOOL_LABEL[next]);
    }
    return next !== null;
  };

  const handleImport = async (files: FileList | null) => {
    const file = firstFile(files);
    if (!file) {
      return;
    }
    const result = parseMapFile(engine, await file.arrayBuffer());
    if (!result.ok) {
      setImportError({ message: result.message, diagnostics: result.diagnostics });
      return;
    }
    setImportError(null);
    setDraft(draftFromMap(result.map));
    toast.success(hu.mapEditor.imported);
  };

  const handleExport = () => {
    if (parsed.map) {
      downloadText(`${safeFilename(details.title)}.txt`, engine.serializeMap(parsed.map));
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({ ...details, title: details.title.trim(), content: text });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="editor-workbench">
      <Panel title={hu.mapEditor.toolsHeading} className="editor-tools">
        <ToolRack tool={tool} dir={draft.dir} onToolChange={setTool} />
        <DirectionPad
          dir={draft.dir}
          onDirChange={(dir: Dir) => setDraft((current) => turnRobot(current, dir))}
        />
      </Panel>

      <Panel title={hu.mapEditor.gridLabel} className="editor-canvas" tone="screen">
        <MineBoard
          map={draftGrid(draft)}
          robot={draftRobot(draft)}
          label={hu.mapEditor.gridLabel}
          describedBy={helpId}
          size="editor"
          onPaint={handlePaint}
          onShortcut={handleShortcut}
        />
        <p id={helpId} className="editor-help">
          {hu.mapEditor.gridHelp}
        </p>
        <output className="visually-hidden">{announcement}</output>
      </Panel>

      <div className="editor-side">
        <Panel title={hu.mapEditor.detailsHeading}>
          <DetailsFields details={details} onChange={setDetails} />
          <div className="editor-size-row">
            <NumberField
              label={hu.mapEditor.rows}
              minValue={MIN_SIZE}
              maxValue={MAX_SIZE}
              value={draft.rows}
              onChange={(rows) => setDraft((current) => resizeDraft(current, rows, current.cols))}
            />
            <NumberField
              label={hu.mapEditor.cols}
              minValue={MIN_SIZE}
              maxValue={MAX_SIZE}
              value={draft.cols}
              onChange={(cols) => setDraft((current) => resizeDraft(current, current.rows, cols))}
            />
          </div>
          <p className="editor-muted">{hu.mapEditor.sizeHelp}</p>
        </Panel>

        <Panel title={hu.mapEditor.checkHeading}>
          <ValidationReadout errors={errors} warnings={warnings} isTitleMissing={isTitleMissing} />
          <Button
            variant="primary"
            icon="save"
            isDisabled={!canSave}
            isPending={isSaving}
            onPress={() => void handleSave()}
          >
            {isSaving ? hu.mapEditor.saving : hu.mapEditor.save}
          </Button>
        </Panel>

        <Panel title={hu.mapEditor.fileHeading}>
          <FileControls
            canExport={parsed.map !== null}
            importError={importError}
            onImport={(files) => void handleImport(files)}
            onExport={handleExport}
          />
        </Panel>

        {version ? (
          <Panel title={hu.mapEditor.versionHeading}>
            <VersionNote version={version} />
            {dangerZone}
          </Panel>
        ) : null}
      </div>
    </div>
  );
}
