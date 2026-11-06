import { hu } from "../i18n/hu.ts";
import type { Mode, Tool } from "./editor-state.ts";

export const TOOL_LABEL: Record<Tool, string> = {
  empty: hu.mapEditor.toolEmpty,
  gold: hu.mapEditor.toolGold,
  wall: hu.mapEditor.toolWall,
  robot: hu.mapEditor.toolRobot,
};

export const MODE_LABEL: Record<Mode, string> = {
  brush: hu.mapEditor.modeBrush,
  rect: hu.mapEditor.modeRect,
  fill: hu.mapEditor.modeFill,
};
