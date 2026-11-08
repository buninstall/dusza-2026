import type { Pos } from "@minescript/engine";
import { type Dispatch, type KeyboardEvent, useRef, useState } from "react";
import { dirNames, hu } from "../i18n/hu.ts";
import type { BoardInteraction, StrokeKind } from "../mine/board-input.ts";
import { samePos } from "../mine/grid-nav.ts";
import {
  type DraftMap,
  floodCells,
  lineCells,
  type Mode,
  modeForKey,
  paint,
  paintCells,
  rectCells,
  rotateRobot,
  type Tool,
  toolForKey,
} from "./editor-state.ts";
import type { HistoryAction } from "./history.ts";
import { TOOL_LABEL } from "./tool-labels.ts";

type CanvasToolsInput = {
  draft: DraftMap;
  dispatch: Dispatch<HistoryAction>;
  tool: Tool;
  mode: Mode;
  setTool: (tool: Tool) => void;
  setMode: (mode: Mode) => void;
  announce: (text: string) => void;
};

export type RectDraft = { anchor: Pos; end: Pos };

export type KeyChord = { key: string; shiftKey: boolean };

function isRobotCell(draft: DraftMap, pos: Pos): boolean {
  return draft.robot?.row === pos.row && draft.robot.col === pos.col;
}

export function useCanvasTools({
  draft,
  dispatch,
  tool,
  mode,
  setTool,
  setMode,
  announce,
}: CanvasToolsInput) {
  const [cursor, setCursor] = useState<Pos>({ row: 0, col: 0 });
  const [hover, setHover] = useState<Pos | null>(null);
  const [rect, setRect] = useState<RectDraft | null>(null);
  const [strokeTool, setStrokeTool] = useState<Tool | null>(null);
  const [quietCell, setQuietCell] = useState<Pos | null>(null);
  const stroke = useRef<{ tool: Tool; isActive: boolean }>({ tool, isActive: false });
  const lastPainted = useRef<Pos | null>(null);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const rectRef = useRef(rect);
  rectRef.current = rect;

  const label = (painted: Tool) => TOOL_LABEL[painted];

  const commit = (next: DraftMap) => {
    draftRef.current = next;
    dispatch({ type: "commit", next });
  };

  const preview = (next: DraftMap) => {
    draftRef.current = next;
    dispatch({ type: "preview", next });
  };

  const beginStroke = (painted: Tool) => {
    stroke.current = { tool: painted, isActive: true };
    setStrokeTool(painted);
  };

  const placeRobot = (pos: Pos) => {
    const current = draftRef.current;
    if (isRobotCell(current, pos)) {
      const turned = rotateRobot(current, "left");
      commit(turned);
      announce(hu.mapEditor.robotTurned(dirNames[turned.dir]));
      return;
    }
    commit(paint(current, pos, "robot", current.dir));
    announce(hu.mapEditor.robotPlaced(pos.row + 1, pos.col + 1, dirNames[current.dir]));
  };

  const paintOne = (pos: Pos, painted: Tool) => {
    commit(paint(draftRef.current, pos, painted, draftRef.current.dir));
    lastPainted.current = pos;
    announce(hu.mapEditor.painted(label(painted), pos.row + 1, pos.col + 1));
  };

  const fillFrom = (pos: Pos, painted: Tool) => {
    const cells = floodCells(draftRef.current, pos);
    commit(paintCells(draftRef.current, cells, painted));
    announce(hu.mapEditor.filled(cells.length, label(painted)));
  };

  const commitRect = (area: RectDraft, painted: Tool) => {
    const cells = rectCells(area.anchor, area.end);
    commit(paintCells(draftRef.current, cells, painted));
    setRect(null);
    announce(hu.mapEditor.rectPainted(cells.length, label(painted)));
  };

  const onStrokeStart = (pos: Pos, kind: StrokeKind, isShift: boolean) => {
    const painted: Tool = kind === "erase" ? "empty" : tool;
    if (painted === "robot") {
      placeRobot(pos);
      return;
    }
    if (mode === "fill") {
      fillFrom(pos, painted);
      return;
    }
    if (mode === "rect") {
      beginStroke(painted);
      setRect({ anchor: pos, end: pos });
      return;
    }
    if (isShift && lastPainted.current) {
      const cells = lineCells(lastPainted.current, pos);
      commit(paintCells(draftRef.current, cells, painted));
      lastPainted.current = pos;
      return;
    }
    beginStroke(painted);
    preview(paint(draftRef.current, pos, painted, draftRef.current.dir));
    lastPainted.current = pos;
  };

  const onStrokeMove = (pos: Pos) => {
    if (!stroke.current.isActive) {
      return;
    }
    if (mode === "rect") {
      setRect((current) => (current ? { ...current, end: pos } : current));
      return;
    }
    const from = lastPainted.current;
    const cells = from ? lineCells(from, pos) : [pos];
    preview(paintCells(draftRef.current, cells, stroke.current.tool));
    lastPainted.current = pos;
  };

  const onStrokeEnd = () => {
    if (!stroke.current.isActive) {
      return;
    }
    stroke.current = { ...stroke.current, isActive: false };
    setStrokeTool(null);
    setQuietCell(rectRef.current?.end ?? lastPainted.current);
    if (rectRef.current) {
      commitRect(rectRef.current, stroke.current.tool);
      return;
    }
    dispatch({ type: "settle" });
  };

  const onEnter = (pos: Pos) => {
    if (tool === "robot") {
      placeRobot(pos);
    } else if (mode === "fill") {
      fillFrom(pos, tool);
    } else if (mode === "rect") {
      if (rect) {
        commitRect({ anchor: rect.anchor, end: pos }, tool);
      } else {
        setRect({ anchor: pos, end: pos });
        announce(hu.mapEditor.rectAnchor(pos.row + 1, pos.col + 1));
      }
    } else {
      paintOne(pos, tool);
    }
  };

  const onLetter = (event: KeyChord): boolean => {
    const nextTool = toolForKey(event.key);
    const nextMode = modeForKey(event.key);
    if (nextTool) {
      setTool(nextTool);
      announce(TOOL_LABEL[nextTool]);
      return true;
    }
    if (event.key === "r" || event.key === "R") {
      const turned = rotateRobot(draftRef.current, event.shiftKey ? "right" : "left");
      commit(turned);
      announce(hu.mapEditor.robotTurned(dirNames[turned.dir]));
      return true;
    }
    if (nextMode) {
      if (tool === "robot") {
        announce(hu.mapEditor.robotSingle);
        return true;
      }
      setMode(nextMode);
      return true;
    }
    return false;
  };

  const onKey = (event: KeyboardEvent<HTMLElement>, pos: Pos): boolean => {
    if (event.ctrlKey || event.metaKey || event.altKey) {
      return false;
    }
    if (event.key === "Enter" || event.key === " ") {
      onEnter(pos);
      return true;
    }
    if (event.key === "Delete" || event.key === "Backspace") {
      paintOne(pos, "empty");
      return true;
    }
    if (event.key === "Escape" && rect) {
      setRect(null);
      announce(hu.mapEditor.rectCancelled);
      return true;
    }
    return false;
  };

  const onNavigate = (pos: Pos, isShift: boolean) => {
    if (rect && !stroke.current.isActive) {
      setRect({ ...rect, end: pos });
      return;
    }
    if (isShift && mode === "brush" && tool !== "robot") {
      stroke.current = { tool, isActive: false };
      preview(paint(draftRef.current, pos, tool, draftRef.current.dir));
      lastPainted.current = pos;
    }
  };

  const interaction: BoardInteraction = {
    cursor,
    onCursorChange: setCursor,
    onKey,
    onNavigate,
    onKeyUp: (event) => {
      if (event.key === "Shift") {
        dispatch({ type: "settle" });
      }
    },
    onStrokeStart,
    onStrokeMove,
    onStrokeEnd,
    onHover: (pos) => {
      setHover(pos);
      setQuietCell((quiet) => (quiet && pos && samePos(quiet, pos) ? quiet : null));
    },
  };

  const shownHover = hover && quietCell && samePos(hover, quietCell) ? null : hover;

  return {
    cursor,
    setCursor,
    hover: shownHover,
    rect,
    ghostTool: strokeTool ?? tool,
    interaction,
    onLetter,
  };
}
