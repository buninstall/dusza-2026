import type { Dir } from "@minescript/engine";
import type { CSSProperties, ReactNode } from "react";
import { Label, Radio, RadioGroup } from "react-aria-components";
import { dirNames, hu } from "../i18n/hu.ts";
import { quarterIndex } from "../mine/quarter-turns.ts";
import type { IconName } from "../pixel/icons.ts";
import { PixelIcon } from "../pixel/PixelIcon.tsx";
import { SPRITE_ID, TILE_SIZE } from "../pixel/tiles.ts";
import { MODES, type Mode, TOOLS, type Tool } from "./editor-state.ts";
import { MODE_LABEL, TOOL_LABEL } from "./tool-labels.ts";

const TOOL_SPRITES: Record<Tool, readonly string[]> = {
  empty: [SPRITE_ID.floor(0)],
  gold: [SPRITE_ID.floor(0), SPRITE_ID.gold],
  wall: [SPRITE_ID.wall(0)],
  robot: [SPRITE_ID.floor(0)],
};

const MODE_ICON: Record<Mode, IconName> = { brush: "brush", rect: "rect", fill: "bucket" };

export function Swatch({ tool, dir }: { tool: Tool; dir: Dir }) {
  const turn = { "--turns": quarterIndex(dir) } as CSSProperties;
  return (
    <span aria-hidden="true" className="ed-swatch">
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
          className="ed-swatch-robot"
          style={turn}
        >
          <use href={`#${SPRITE_ID.robot}`} />
        </svg>
      ) : null}
    </span>
  );
}

const COMPASS: readonly { dir: Dir; icon: IconName }[] = [
  { dir: "north", icon: "arrowUp" },
  { dir: "east", icon: "arrowRight" },
  { dir: "south", icon: "arrowDown" },
  { dir: "west", icon: "arrowLeft" },
];

type ToolRailProps = {
  tool: Tool;
  mode: Mode;
  dir: Dir;
  hasRobot: boolean;
  onToolChange: (tool: Tool) => void;
  onModeChange: (mode: Mode) => void;
  onDirChange: (dir: Dir) => void;
  actions?: ReactNode;
};

export function ToolRail({
  tool,
  mode,
  dir,
  hasRobot,
  onToolChange,
  onModeChange,
  onDirChange,
  actions,
}: ToolRailProps) {
  return (
    <aside aria-label={hu.mapEditor.toolsLabel} className="ed-rail">
      <RadioGroup
        value={tool}
        onChange={(value) => onToolChange(TOOLS.find((item) => item === value) ?? "wall")}
        className="ed-group"
      >
        <Label className="label">{hu.mapEditor.toolsLabel}</Label>
        <div className="ed-options" data-kind="tools">
          {TOOLS.map((item) => (
            <Radio key={item} value={item} className="ed-option">
              <Swatch tool={item} dir={dir} />
              <span className="ed-option-label">{TOOL_LABEL[item]}</span>
              {item === "robot" && !hasRobot ? (
                <span className="ed-missing">
                  <PixelIcon name="error" size="sm" />
                  {hu.mapEditor.toolMissing}
                </span>
              ) : null}
            </Radio>
          ))}
        </div>
      </RadioGroup>
      <RadioGroup
        value={dir}
        onChange={(value) => onDirChange(COMPASS.find((item) => item.dir === value)?.dir ?? "east")}
        className="ed-group"
        data-active={tool === "robot"}
      >
        <Label className="label">{hu.mapEditor.robotDir}</Label>
        <div className="ed-compass">
          {COMPASS.map((item) => (
            <Radio key={item.dir} value={item.dir} className="ed-compass-key">
              <PixelIcon name={item.icon} />
              <span>{dirNames[item.dir]}</span>
            </Radio>
          ))}
        </div>
      </RadioGroup>
      <RadioGroup
        value={mode}
        onChange={(value) => onModeChange(MODES.find((item) => item === value) ?? "brush")}
        className="ed-group"
        data-inactive={tool === "robot"}
      >
        <span className="ed-group-head">
          <Label className="label">{hu.mapEditor.modeLabel}</Label>
          <span className="ed-group-value" aria-hidden="true">
            {MODE_LABEL[mode]}
          </span>
        </span>
        <div className="ed-modes">
          {MODES.map((item) => (
            <Radio key={item} value={item} className="ed-option ed-mode">
              <PixelIcon name={MODE_ICON[item]} />
              <span className="visually-hidden">{MODE_LABEL[item]}</span>
            </Radio>
          ))}
        </div>
      </RadioGroup>
      {actions ? <div className="ed-actions">{actions}</div> : null}
    </aside>
  );
}
