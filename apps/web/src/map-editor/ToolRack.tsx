import type { Dir } from "@minescript/engine";
import type { CSSProperties } from "react";
import { Label, Radio, RadioGroup } from "react-aria-components";
import { dirNames, hu } from "../i18n/hu.ts";
import { quarterIndex } from "../mine/quarter-turns.ts";
import type { IconName } from "../pixel/icons.ts";
import { PixelIcon } from "../pixel/PixelIcon.tsx";
import { SPRITE_ID, TILE_SIZE } from "../pixel/tiles.ts";
import { TOOLS, type Tool } from "./editor-state.ts";
import "./MapEditor.css";

export const TOOL_LABEL: Record<Tool, string> = {
  empty: hu.mapEditor.toolEmpty,
  gold: hu.mapEditor.toolGold,
  wall: hu.mapEditor.toolWall,
  robot: hu.mapEditor.toolRobot,
};

const TOOL_SPRITES: Record<Tool, readonly string[]> = {
  empty: [SPRITE_ID.floor(0)],
  gold: [SPRITE_ID.floor(0), SPRITE_ID.gold],
  wall: [SPRITE_ID.wall(0)],
  robot: [SPRITE_ID.floor(0)],
};

function Swatch({ tool, dir }: { tool: Tool; dir: Dir }) {
  const turn = { "--turns": quarterIndex(dir) } as CSSProperties;
  return (
    <span aria-hidden="true" className="editor-swatch">
      <svg aria-hidden="true" viewBox={`0 0 ${TILE_SIZE} ${TILE_SIZE}`} shapeRendering="crispEdges">
        {TOOL_SPRITES[tool].map((id) => (
          <use key={id} href={`#${id}`} />
        ))}
      </svg>
      {tool === "robot" ? (
        <svg
          aria-hidden="true"
          viewBox={`0 0 ${TILE_SIZE} ${TILE_SIZE}`}
          shapeRendering="crispEdges"
          className="editor-swatch-robot"
          style={turn}
        >
          <use href={`#${SPRITE_ID.robot}`} />
        </svg>
      ) : null}
    </span>
  );
}

type ToolRackProps = { tool: Tool; dir: Dir; onToolChange: (tool: Tool) => void };

export function ToolRack({ tool, dir, onToolChange }: ToolRackProps) {
  return (
    <RadioGroup
      value={tool}
      onChange={(value) => onToolChange(TOOLS.find((item) => item === value) ?? "wall")}
      className="editor-rack"
    >
      <Label className="editor-rack-label">{hu.mapEditor.toolsLabel}</Label>
      {TOOLS.map((item, index) => (
        <Radio key={item} value={item} className="editor-tool">
          <Swatch tool={item} dir={dir} />
          <span className="editor-tool-name">{TOOL_LABEL[item]}</span>
          <kbd>{index + 1}</kbd>
        </Radio>
      ))}
    </RadioGroup>
  );
}

const PAD: readonly { dir: Dir; icon: IconName; area: string }[] = [
  { dir: "north", icon: "arrowUp", area: "n" },
  { dir: "west", icon: "arrowLeft", area: "w" },
  { dir: "east", icon: "arrowRight", area: "e" },
  { dir: "south", icon: "arrowDown", area: "s" },
];

type DirectionPadProps = { dir: Dir; onDirChange: (dir: Dir) => void };

export function DirectionPad({ dir, onDirChange }: DirectionPadProps) {
  return (
    <RadioGroup
      value={dir}
      onChange={(value) => onDirChange(PAD.find((item) => item.dir === value)?.dir ?? "east")}
      className="editor-pad-group"
    >
      <Label className="editor-rack-label">{hu.mapEditor.robotDir}</Label>
      <div className="editor-pad">
        {PAD.map((item) => (
          <Radio
            key={item.dir}
            value={item.dir}
            className="editor-pad-key"
            style={{ gridArea: item.area }}
          >
            <PixelIcon name={item.icon} />
            <span>{dirNames[item.dir]}</span>
          </Radio>
        ))}
        <span className="editor-pad-center">
          <Swatch tool="robot" dir={dir} />
        </span>
      </div>
    </RadioGroup>
  );
}
