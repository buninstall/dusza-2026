import type { MineMap, RobotState } from "@minescript/engine";
import type { ReactNode } from "react";
import { DropZone, ToggleButton } from "react-aria-components";
import { Button } from "../components/ui/Button.tsx";
import { NumberField } from "../components/ui/NumberField.tsx";
import { hu } from "../i18n/hu.ts";
import type { BoardInteraction } from "../mine/board-input.ts";
import { MineBoard, type RulerMarks } from "../mine/MineBoard.tsx";
import { PixelIcon } from "../pixel/PixelIcon.tsx";
import { KeysPopover } from "../play/stage/KeysPopover.tsx";
import { MAX_SIZE, MIN_SIZE } from "./editor-state.ts";

type SizeProps = {
  onRows: (rows: number) => void;
  onCols: (cols: number) => void;
  doomNotes: { row: string | null; col: string | null };
};

function SizeStepper({
  label,
  value,
  kind,
  onChange,
}: {
  label: string;
  value: number;
  kind: "row" | "col";
  onChange: (value: number) => void;
}) {
  return (
    <div className="ed-stepper" data-kind={kind}>
      <NumberField
        label={label}
        minValue={MIN_SIZE}
        maxValue={MAX_SIZE}
        value={value}
        onChange={(next) => onChange(Number.isFinite(next) ? next : value)}
      />
    </div>
  );
}

type StripProps = {
  cursorText: string;
  toolText: string;
  canUndo: boolean;
  canRedo: boolean;
  showReach: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onReachChange: (isShown: boolean) => void;
};

function CanvasStrip(props: StripProps) {
  return (
    <div className="ed-strip">
      <Button
        size="sm"
        icon="undo"
        isDisabled={!props.canUndo}
        aria-keyshortcuts="Control+Z"
        onPress={props.onUndo}
      >
        {hu.mapEditor.undo}
      </Button>
      <Button
        size="sm"
        icon="redo"
        isDisabled={!props.canRedo}
        aria-keyshortcuts="Control+Shift+Z"
        onPress={props.onRedo}
      >
        {hu.mapEditor.redo}
      </Button>
      <span className="ed-strip-text">
        <span className="mono">{props.cursorText}</span>
        <span className="ed-strip-tool">{props.toolText}</span>
      </span>
      <ToggleButton
        isSelected={props.showReach}
        onChange={props.onReachChange}
        className="btn ed-reach"
        data-variant="ghost"
        data-size="sm"
      >
        <PixelIcon name="eye" />
        {hu.mapEditor.reach}
      </ToggleButton>
      <KeysPopover rows={hu.mapEditor.shortcuts} />
    </div>
  );
}

type EditorCanvasProps = SizeProps &
  StripProps & {
    map: MineMap;
    robot: RobotState | null;
    helpId: string;
    interaction: BoardInteraction;
    overlay: ReactNode;
    cellNotes: ReadonlyMap<string, string>;
    rulerMarks: RulerMarks;
    isDropping: boolean;
    onDropFile: (file: File) => void;
    onDropChange: (isDropping: boolean) => void;
  };

export function EditorCanvas(props: EditorCanvasProps) {
  const { map } = props;
  const edges = {
    end: (
      <SizeStepper label={hu.mapEditor.cols} value={map.cols} kind="col" onChange={props.onCols} />
    ),
    bottom: (
      <SizeStepper label={hu.mapEditor.rows} value={map.rows} kind="row" onChange={props.onRows} />
    ),
  };
  return (
    <section aria-label={hu.mapEditor.gridLabel} className="ed-canvas">
      <DropZone
        aria-label={hu.mapEditor.dropZone}
        className="ed-drop"
        data-dropping={props.isDropping}
        onDropEnter={() => props.onDropChange(true)}
        onDropExit={() => props.onDropChange(false)}
        onDrop={async (event) => {
          props.onDropChange(false);
          for (const item of event.items) {
            if (item.kind === "file") {
              props.onDropFile(await item.getFile());
              return;
            }
          }
        }}
      >
        <div className="ed-scroll">
          <MineBoard
            map={map}
            robot={props.robot}
            label={hu.mapEditor.gridLabel}
            describedBy={props.helpId}
            size="editor"
            fit="both"
            interaction={props.interaction}
            overlay={props.overlay}
            cellNotes={props.cellNotes}
            rulerMarks={props.rulerMarks}
            edges={edges}
          />
        </div>
        <p className="ed-drop-hint" aria-hidden="true">
          {hu.mapEditor.dropHint}
        </p>
      </DropZone>
      {props.doomNotes.row ? (
        <p className="ed-size-note" data-kind="row">
          {props.doomNotes.row}
        </p>
      ) : null}
      {props.doomNotes.col ? (
        <p className="ed-size-note" data-kind="col">
          {props.doomNotes.col}
        </p>
      ) : null}
      <CanvasStrip {...props} />
      <p id={props.helpId} className="visually-hidden">
        {hu.mapEditor.gridHelp}
      </p>
    </section>
  );
}
