import type { Pos } from "@minescript/engine";
import {
  type ReactNode,
  type RefObject,
  useId,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { flushSync } from "react-dom";
import { Button } from "../components/ui/Button.tsx";
import { Menu, MenuItem } from "../components/ui/Menu.tsx";
import { toast } from "../components/ui/Toast.tsx";
import { useEngine } from "../engine/useEngine.ts";
import { hu } from "../i18n/hu.ts";
import { api, call, errorMessage } from "../lib/api.ts";
import { downloadText, safeFilename } from "../lib/files.ts";
import { useRustWear } from "../lib/rust-wear.ts";
import { hasVisibleText } from "../lib/text.ts";
import { clampSceneZoom, nextSceneZoom, SCENE_ZOOM_MIN } from "../mine/scene/zoom.ts";
import { canvasOverlay } from "./canvas-overlay.tsx";
import { EditorBar, type SaveState } from "./EditorBar.tsx";
import { EditorCanvas } from "./EditorCanvas.tsx";
import {
  changedCells,
  clearDraft,
  type DraftMap,
  draftFromMap,
  draftGrid,
  draftRobot,
  draftToText,
  frameDraft,
  type Mode,
  resizeDraft,
  type Tool,
  turnRobot,
} from "./editor-state.ts";
import { GeneratorDialog } from "./GeneratorDialog.tsx";
import { historyReducer, initialHistory } from "./history.ts";
import {
  CheckList,
  DetailsBlock,
  type ImportError,
  ImportErrorNotice,
  type MapDetails,
  VersionBlock,
  type VersionInfo,
} from "./Inspector.tsx";
import { LeaveGuard } from "./LeaveGuard.tsx";
import "./MapEditor.css";
import { KeysPopover } from "../play/stage/KeysPopover.tsx";
import {
  doomNotes,
  rectTag,
  shroudedCells,
  splitDiagnostics,
  unreachableMarks,
} from "./editor-issues.ts";
import { parseMapFile } from "./map-file.ts";
import { ToolRail } from "./ToolRail.tsx";
import { TrialPlay } from "./TrialPlay.tsx";
import { useCanvasTools } from "./useCanvasTools.ts";
import { type EditorKeys, useEditorKeys, type ZoomStep } from "./useEditorKeys.ts";

export type MapFormValues = MapDetails & { content: string };

type MapEditorProps = {
  mapId: number | null;
  initialDraft: DraftMap;
  initialDetails: MapDetails;
  version: VersionInfo | null;
  onSave: (values: MapFormValues) => Promise<boolean>;
  onDelete?: (() => Promise<boolean>) | undefined;
};

type Baseline = { text: string; details: MapDetails };

type EditorRootProps = {
  rootRef: RefObject<HTMLDivElement | null>;
  tool: Tool;
  keys: EditorKeys;
  children: ReactNode;
};

function EditorRoot({ rootRef, tool, keys, children }: EditorRootProps) {
  useRustWear(rootRef);
  useEditorKeys(rootRef, keys);
  return (
    <div ref={rootRef} className="ed" data-tool={tool} data-theme="tarna" data-skin="akna">
      {children}
    </div>
  );
}

export function MapEditor({
  mapId,
  initialDraft,
  initialDetails,
  version,
  onSave,
  onDelete,
}: MapEditorProps) {
  const engine = useEngine();
  const helpId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const checkRef = useRef<HTMLHeadingElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const isLeaving = useRef(false);
  const [history, dispatch] = useReducer(historyReducer, initialDraft, initialHistory);
  const [details, setDetails] = useState(initialDetails);
  const [zoom, setZoom] = useState(1);
  const [parSource, setParSource] = useState(() => draftToText(initialDraft));
  const [baseline, setBaseline] = useState<Baseline>({
    text: draftToText(initialDraft),
    details: initialDetails,
  });
  const [tool, setTool] = useState<Tool>("wall");
  const [mode, setMode] = useState<Mode>("brush");
  const [showReach, setShowReach] = useState(false);
  const [isDropping, setDropping] = useState(false);
  const [importError, setImportError] = useState<ImportError | null>(null);
  const [saveState, setSaveState] = useState<SaveState>(mapId === null ? "new" : "clean");
  const [flash, setFlash] = useState<{ cells: readonly Pos[]; key: number } | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [isTrying, setTrying] = useState(false);
  const [isGenerating, setGenerating] = useState(false);
  const [isComputingPar, setComputingPar] = useState(false);
  const draft = history.present;
  const selectTool = (next: Tool) => {
    if (next !== tool) setMode("brush");
    setTool(next);
  };
  const tools = useCanvasTools({
    draft,
    dispatch,
    tool,
    mode,
    setTool: selectTool,
    setMode,
    announce: setAnnouncement,
  });

  const text = useMemo(() => draftToText(draft), [draft]);
  const parsed = useMemo(() => engine.parseMap(text), [engine, text]);
  const info = useMemo(
    () => (parsed.map ? engine.mapInfo(parsed.map) : null),
    [engine, parsed.map],
  );
  const { errors, warnings } = splitDiagnostics(parsed.diagnostics);
  const isTitleMissing = !hasVisibleText(details.title);
  const isValid = parsed.map !== null && !isTitleMissing;
  const isDirty =
    text !== baseline.text || JSON.stringify(details) !== JSON.stringify(baseline.details);
  const isFork = version !== null && version.runCount > 0 && text !== baseline.text;
  const unreachable = info?.unreachable ?? [];
  const grid = draftGrid(draft);

  const step = (type: "undo" | "redo") => {
    const target = type === "undo" ? history.past[history.past.length - 1] : history.future[0];
    if (!target) {
      return;
    }
    setFlash({ cells: changedCells(draft, target), key: Date.now() });
    dispatch({ type });
    setAnnouncement(type === "undo" ? hu.mapEditor.undone : hu.mapEditor.redone);
  };

  const importFile = async (file: File) => {
    const result = parseMapFile(engine, await file.arrayBuffer());
    if (!result.ok) {
      setImportError({ file: file.name, message: result.message, diagnostics: result.diagnostics });
      return;
    }
    setImportError(null);
    dispatch({ type: "commit", next: draftFromMap(result.map) });
    toast.success(hu.mapEditor.imported);
  };

  const exportMap = () => {
    if (!parsed.map) {
      toast.error(hu.mapEditor.exportBlocked);
      return;
    }
    const filename = `${safeFilename(details.title)}.txt`;
    downloadText(filename, engine.serializeMap(parsed.map));
    toast.success(hu.mapEditor.exported(filename));
  };

  const save = async () => {
    if (!isValid) {
      requestAnimationFrame(() => checkRef.current?.focus());
      const blocked = hu.mapEditor.saveBlocked(errors.length + (isTitleMissing ? 1 : 0));
      setAnnouncement(blocked);
      toast.error(blocked);
      return;
    }
    setSaveState("saving");
    isLeaving.current = true;
    const values = { ...details, title: details.title.trim(), content: text };
    const isSaved = await onSave(values);
    isLeaving.current = false;
    setSaveState(isSaved ? "saved" : "dirty");
    if (isSaved) {
      setBaseline({ text, details });
    }
  };

  const goTo = (pos: Pos) => {
    flushSync(() => tools.setCursor(pos));
    rootRef.current
      ?.querySelector<HTMLElement>(`[data-row="${pos.row}"][data-col="${pos.col}"]`)
      ?.focus();
  };

  const zoomBy = (zoomStep: ZoomStep) =>
    setZoom((current) => (zoomStep === 0 ? SCENE_ZOOM_MIN : nextSceneZoom(current, zoomStep)));

  const keys: EditorKeys = {
    undo: () => step("undo"),
    redo: () => step("redo"),
    save: () => void save(),
    zoom: zoomBy,
    letter: tools.onLetter,
  };

  const shownState: SaveState = saveState === "saving" || !isDirty ? saveState : "dirty";
  const marks = unreachableMarks(unreachable);
  const overlay = canvasOverlay({
    draft,
    tool: tools.ghostTool,
    cursor: tools.cursor,
    hover: tools.hover,
    rect: tools.rect,
    rectTag: rectTag(tools.rect),
    unreachable,
    shrouded: showReach ? shroudedCells(draft) : [],
    flash,
  });
  const leave = async () => {
    isLeaving.current = true;
    const deleted = await onDelete?.();
    if (deleted === false) {
      isLeaving.current = false;
    }
  };

  const commitShape = (next: DraftMap, message: string) => {
    dispatch({ type: "commit", next });
    setFlash({ cells: changedCells(draft, next), key: Date.now() });
    setAnnouncement(message);
  };

  const computePar = async () => {
    setComputingPar(true);
    try {
      const { parSteps } = await call(api.maps.par.$post({ json: { content: text } }));
      if (parSteps === null) {
        toast.info(hu.par.noSolution);
        return;
      }
      setDetails((current) => ({ ...current, parSteps }));
      setParSource(text);
      toast.success(hu.par.computed(parSteps));
    } catch (error) {
      toast.error(errorMessage(error, hu.par.failed));
    } finally {
      setComputingPar(false);
    }
  };

  const tryOut = () => {
    if (!parsed.map) {
      toast.error(hu.trial.blocked);
      requestAnimationFrame(() => checkRef.current?.focus());
      return;
    }
    setTrying(true);
  };

  if (isTrying && parsed.map) {
    return (
      <>
        <TrialPlay
          map={parsed.map}
          text={text}
          title={details.title}
          onBack={() => setTrying(false)}
        />
        <LeaveGuard shouldBlock={() => isDirty && !isLeaving.current} />
      </>
    );
  }

  return (
    <EditorRoot rootRef={rootRef} tool={tool} keys={keys}>
      <EditorBar
        mapId={mapId}
        title={details.title}
        version={version?.current ?? null}
        forkVersion={isFork && version ? version.next : null}
        saveState={shownState}
        isSaveBlocked={!isValid}
        isExportBlocked={parsed.map === null}
        titleRef={titleRef}
        onTitleChange={(title) => setDetails({ ...details, title })}
        onImport={(file) => void importFile(file)}
        onExport={exportMap}
        onTry={tryOut}
        onSave={() => void save()}
      />
      <div className="ed-left">
        <ToolRail
          tool={tool}
          mode={mode}
          dir={draft.dir}
          hasRobot={draft.robot !== null}
          onToolChange={selectTool}
          onModeChange={setMode}
          onDirChange={(dir) => dispatch({ type: "commit", next: turnRobot(draft, dir) })}
          actions={
            <>
              <Button size="sm" icon="dice" onPress={() => setGenerating(true)}>
                {hu.generator.menuItem}
              </Button>
              <span className="ed-actions-row">
                <Menu
                  label={hu.shape.heading}
                  ariaLabel={hu.shape.heading}
                  icon="chevronDown"
                  variant="secondary"
                  placement="bottom start"
                >
                  <MenuItem onAction={() => commitShape(frameDraft(draft), hu.shape.framed)}>
                    {hu.shape.frame}
                  </MenuItem>
                  <MenuItem onAction={() => commitShape(clearDraft(draft), hu.shape.cleared)}>
                    {hu.shape.clear}
                  </MenuItem>
                  <MenuItem onAction={() => setGenerating(true)}>{hu.generator.menuItem}</MenuItem>
                </Menu>
                <KeysPopover
                  rows={hu.mapEditor.shortcuts}
                  placement="end bottom"
                  variant="secondary"
                />
              </span>
            </>
          }
        />
        {version && mapId !== null ? (
          <VersionBlock mapId={mapId} title={details.title} version={version} onDelete={leave} />
        ) : null}
      </div>
      <GeneratorDialog
        isOpen={isGenerating}
        onOpenChange={setGenerating}
        rows={draft.rows}
        cols={draft.cols}
        onGenerated={(map, parSteps) => {
          const generated = draftFromMap(map);
          commitShape(generated, hu.generator.done(parSteps));
          setDetails((current) => ({ ...current, parSteps }));
          setParSource(draftToText(generated));
        }}
      />
      <EditorCanvas
        map={grid}
        robot={draftRobot(draft)}
        helpId={helpId}
        interaction={tools.interaction}
        overlay={overlay}
        cellNotes={marks.notes}
        rulerMarks={marks.rulers}
        isDropping={isDropping}
        zoom={zoom}
        onZoomChange={(next) => setZoom(clampSceneZoom(next))}
        onDropChange={setDropping}
        onDropFile={(file) => void importFile(file)}
        onRows={(rows) => dispatch({ type: "commit", next: resizeDraft(draft, rows, draft.cols) })}
        onCols={(cols) => dispatch({ type: "commit", next: resizeDraft(draft, draft.rows, cols) })}
        doomNotes={doomNotes(draft)}
        cursorText={hu.mapEditor.cursorAt(tools.cursor.row + 1, tools.cursor.col + 1)}
        canUndo={history.past.length > 0}
        canRedo={history.future.length > 0}
        showReach={showReach}
        onUndo={() => step("undo")}
        onRedo={() => step("redo")}
        onReachChange={setShowReach}
      />
      <div className="ed-inspect">
        {importError ? (
          <ImportErrorNotice error={importError} onClose={() => setImportError(null)} />
        ) : null}
        <CheckList
          errors={errors}
          warnings={warnings}
          isTitleMissing={isTitleMissing}
          unreachable={unreachable}
          headingRef={checkRef}
          onFixTitle={() => titleRef.current?.focus()}
          onPickRobot={() => selectTool("robot")}
          onPickGold={() => selectTool("gold")}
          onGoTo={goTo}
        />
        <DetailsBlock
          details={details}
          onChange={(next) => {
            if (next.parSteps !== details.parSteps) {
              setParSource(text);
            }
            setDetails(next);
          }}
          isParStale={details.parSteps !== null && parSource !== text}
          canComputePar={parsed.map !== null}
          isComputingPar={isComputingPar}
          onComputePar={() => void computePar()}
        />
      </div>
      <output className="visually-hidden">{announcement}</output>
      <LeaveGuard shouldBlock={() => isDirty && !isLeaving.current} />
    </EditorRoot>
  );
}
