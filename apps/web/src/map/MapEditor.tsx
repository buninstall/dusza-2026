import type { Diagnostic, Dir } from "@minescript/engine";
import { BrickWall, Download, Gem, Navigation2, Square, Upload } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import { FileTrigger, Label, Radio, RadioGroup } from "react-aria-components";
import { Notice } from "../components/Notice.tsx";
import { Button } from "../components/ui/Button.tsx";
import { NumberField } from "../components/ui/NumberField.tsx";
import { Select } from "../components/ui/Select.tsx";
import { TextField } from "../components/ui/TextField.tsx";
import { toast } from "../components/ui/Toast.tsx";
import { useEngine } from "../engine/useEngine.ts";
import { dirNames, hu } from "../i18n/hu.ts";
import { downloadText, readFirstFile, safeFilename } from "../lib/files.ts";
import {
  type DraftMap,
  draftForDisplay,
  draftFromMap,
  draftToText,
  MAX_SIZE,
  MIN_SIZE,
  paint,
  resizeDraft,
  type Tool,
} from "./editor-state.ts";
import { MapGrid } from "./MapGrid.tsx";

export type MapFormValues = {
  title: string;
  description: string;
  visibility: "public" | "private";
  content: string;
};

type MapEditorProps = {
  initialDraft: DraftMap;
  initialValues: Omit<MapFormValues, "content">;
  onSave: (values: MapFormValues) => Promise<void>;
  extraActions?: ReactNode;
};

const TOOLS: { id: Tool; label: string; icon: ReactNode }[] = [
  { id: "empty", label: hu.editor.toolEmpty, icon: <Square aria-hidden size={16} /> },
  { id: "gold", label: hu.editor.toolGold, icon: <Gem aria-hidden size={16} /> },
  { id: "wall", label: hu.editor.toolWall, icon: <BrickWall aria-hidden size={16} /> },
  { id: "robot", label: hu.editor.toolRobot, icon: <Navigation2 aria-hidden size={16} /> },
];

const DIR_OPTIONS = (["east", "north", "west", "south"] as const).map((id) => ({
  id,
  label: dirNames[id],
}));

function DiagnosticList({ diagnostics }: { diagnostics: readonly Diagnostic[] }) {
  return (
    <ul className="mt-1 list-disc pl-5">
      {diagnostics.map((diagnostic, index) => (
        <li key={`${diagnostic.code}-${index.toString()}`}>
          {hu.play.syntaxErrorLine(diagnostic.span.line)}: {diagnostic.message}
        </li>
      ))}
    </ul>
  );
}

export function MapEditor({ initialDraft, initialValues, onSave, extraActions }: MapEditorProps) {
  const engine = useEngine();
  const [draft, setDraft] = useState(initialDraft);
  const [tool, setTool] = useState<Tool>("wall");
  const [dir, setDir] = useState<Dir>(initialDraft.dir);
  const [values, setValues] = useState(initialValues);
  const [saving, setSaving] = useState(false);

  const text = useMemo(() => draftToText(draft), [draft]);
  const parsed = useMemo(() => engine.parseMap(text), [engine, text]);
  const errors = parsed.diagnostics.filter((diagnostic) => diagnostic.severity === "error");
  const warnings = parsed.diagnostics.filter((diagnostic) => diagnostic.severity !== "error");
  const isValid = parsed.map !== null && values.title.trim().length > 0;

  const importFile = async (files: FileList | null) => {
    const content = await readFirstFile(files);
    if (content === null) {
      return;
    }
    const result = engine.parseMap(content);
    if (!result.map) {
      const details = result.diagnostics
        .filter((diagnostic) => diagnostic.severity === "error")
        .map((diagnostic) => `${diagnostic.span.line}. sor: ${diagnostic.message}`)
        .join(" ");
      toast.error(`${hu.editor.importFailed} ${details}`);
      return;
    }
    setDraft(draftFromMap(result.map));
    setDir(result.map.dir);
    toast.success(hu.editor.imported);
  };

  const save = async () => {
    setSaving(true);
    try {
      await onSave({ ...values, content: text });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
      <section aria-label={hu.editor.titleField} className="plate flex flex-col gap-5 p-5">
        <TextField
          label={hu.editor.titleField}
          value={values.title}
          onChange={(title) => setValues((current) => ({ ...current, title }))}
          isRequired
          maxLength={80}
        />
        <TextField
          label={hu.editor.descriptionField}
          value={values.description}
          onChange={(description) => setValues((current) => ({ ...current, description }))}
          multiline
          maxLength={500}
        />
        <Select
          label={hu.editor.visibility}
          value={values.visibility}
          onChange={(visibility) => setValues((current) => ({ ...current, visibility }))}
          options={[
            { id: "public", label: hu.maps.public },
            { id: "private", label: hu.maps.private },
          ]}
        />
        <div className="flex gap-4">
          <NumberField
            label={hu.editor.rows}
            minValue={MIN_SIZE}
            maxValue={MAX_SIZE}
            value={draft.rows}
            onChange={(rows) => setDraft((current) => resizeDraft(current, rows, current.cols))}
          />
          <NumberField
            label={hu.editor.cols}
            minValue={MIN_SIZE}
            maxValue={MAX_SIZE}
            value={draft.cols}
            onChange={(cols) => setDraft((current) => resizeDraft(current, current.rows, cols))}
          />
        </div>
        <RadioGroup
          value={tool}
          onChange={(value) => setTool(TOOLS.find((item) => item.id === value)?.id ?? "wall")}
          className="flex flex-col gap-2"
        >
          <Label className="text-sm font-semibold">{hu.editor.tools}</Label>
          <div className="grid grid-cols-2 gap-2">
            {TOOLS.map((item) => (
              <Radio
                key={item.id}
                value={item.id}
                className="flex cursor-default items-center gap-2 rounded-[10px] border border-line-strong px-3 py-2 text-sm font-semibold outline-none data-[hovered]:border-ink data-[selected]:border-ink data-[selected]:bg-ink data-[selected]:text-paper data-[focus-visible]:outline-3 data-[focus-visible]:outline-lamp"
              >
                {item.icon}
                {item.label}
              </Radio>
            ))}
          </div>
        </RadioGroup>
        <Select
          label={hu.editor.robotDir}
          value={dir}
          onChange={(next) => {
            setDir(next);
            setDraft((current) => (current.robot ? { ...current, dir: next } : current));
          }}
          options={DIR_OPTIONS}
        />
        <div className="flex flex-wrap gap-2">
          <FileTrigger
            acceptedFileTypes={[".txt", "text/plain"]}
            onSelect={(files) => void importFile(files)}
          >
            <Button size="sm">
              <Upload aria-hidden size={16} />
              {hu.editor.importMap}
            </Button>
          </FileTrigger>
          <Button
            size="sm"
            isDisabled={parsed.map === null}
            onPress={() => downloadText(`${safeFilename(values.title)}.txt`, text)}
          >
            <Download aria-hidden size={16} />
            {hu.editor.exportMap}
          </Button>
        </div>
      </section>

      <section aria-label={hu.editor.gridLabel} className="flex flex-col gap-4">
        <MapGrid
          map={draftForDisplay(draft)}
          mode="edit"
          label={hu.editor.gridLabel}
          robot={draft.robot ? { pos: draft.robot, dir: draft.dir } : null}
          onCellActivate={(pos) => setDraft((current) => paint(current, pos, tool, dir))}
        />
        {errors.length > 0 ? (
          <Notice tone="error" title={hu.editor.invalid}>
            <DiagnosticList diagnostics={errors} />
          </Notice>
        ) : (
          <Notice tone="success" title={hu.editor.valid}>
            {warnings.length > 0 ? <DiagnosticList diagnostics={warnings} /> : null}
          </Notice>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="primary"
            isDisabled={!isValid}
            isPending={saving}
            onPress={() => void save()}
          >
            {saving ? hu.editor.saving : hu.editor.save}
          </Button>
          {extraActions}
        </div>
      </section>
    </div>
  );
}
