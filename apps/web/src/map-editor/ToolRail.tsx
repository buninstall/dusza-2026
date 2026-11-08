import type { Dir } from "@minescript/engine";
import type { ReactNode } from "react";
import { Label, Radio, RadioGroup } from "react-aria-components";
import { dirNames, hu } from "../i18n/hu.ts";
import type { IconName } from "../pixel/icons.ts";
import { MINE_ART } from "../pixel/mine-art.ts";
import { PixelIcon } from "../pixel/PixelIcon.tsx";
import { type Sprite, sprite } from "../pixel/pixel-art.ts";
import { PixelSprite } from "../pixel/SpriteLayers.tsx";
import { MODES, type Mode, TOOLS, type Tool } from "./editor-state.ts";
import { MODE_LABEL, TOOL_LABEL } from "./tool-labels.ts";

type RackArt = { rows: readonly string[]; tones: Readonly<Record<string, string>> };

function rackSprite(art: RackArt): Sprite {
  return sprite(art.rows, art.tones);
}

const TOOL_ART: Record<Tool, Sprite> = {
  empty: rackSprite(MINE_ART.toolEmpty),
  gold: rackSprite(MINE_ART.toolGold),
  wall: rackSprite(MINE_ART.toolWall),
  robot: rackSprite(MINE_ART.toolRobot),
};

const MODE_ART: Record<Mode, Sprite> = {
  brush: rackSprite(MINE_ART.modeBrush),
  rect: rackSprite(MINE_ART.modeRect),
  fill: rackSprite(MINE_ART.modeFill),
};

const COMPASS: readonly { dir: Dir; icon: IconName }[] = [
  { dir: "north", icon: "arrowUp" },
  { dir: "east", icon: "arrowRight" },
  { dir: "south", icon: "arrowDown" },
  { dir: "west", icon: "arrowLeft" },
];

function RackSlot({
  value,
  art,
  label,
  children,
}: {
  value: string;
  art: Sprite;
  label: string;
  children?: ReactNode;
}) {
  return (
    <Radio value={value} className="k-rack-slot ed-slot">
      <span className="k-rack-art ed-slot-art" aria-hidden="true">
        <PixelSprite sprite={art} />
      </span>
      <span className="k-tag ed-slot-tag">{label}</span>
      {children}
    </Radio>
  );
}

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
        className="ed-rack-group"
      >
        <Label className="ed-label ed-group-label">{hu.mapEditor.toolsLabel}</Label>
        <div className="k-rack ed-rack" data-kind="tools">
          {TOOLS.map((item) => (
            <RackSlot key={item} value={item} art={TOOL_ART[item]} label={TOOL_LABEL[item]}>
              {item === "robot" && !hasRobot ? (
                <span className="ed-missing">
                  <PixelIcon name="error" size="sm" />
                  {hu.mapEditor.toolMissing}
                </span>
              ) : null}
            </RackSlot>
          ))}
        </div>
      </RadioGroup>
      <RadioGroup
        value={mode}
        onChange={(value) => onModeChange(MODES.find((item) => item === value) ?? "brush")}
        orientation="horizontal"
        className="ed-rack-group"
        data-inactive={tool === "robot"}
      >
        <Label className="ed-label ed-group-label">{hu.mapEditor.modeLabel}</Label>
        <div className="k-rack ed-rack" data-kind="modes">
          {MODES.map((item) => (
            <RackSlot key={item} value={item} art={MODE_ART[item]} label={MODE_LABEL[item]} />
          ))}
        </div>
      </RadioGroup>
      <RadioGroup
        value={dir}
        onChange={(value) => onDirChange(COMPASS.find((item) => item.dir === value)?.dir ?? "east")}
        orientation="horizontal"
        className="ed-rack-group ed-dirs"
        data-active={tool === "robot"}
      >
        <Label className="ed-label ed-group-label">{hu.mapEditor.robotDir}</Label>
        <div className="k-panel k-panel--inset ed-compass">
          {COMPASS.map((item) => (
            <Radio key={item.dir} value={item.dir} className="k-btn k-btn--icon ed-dir">
              <PixelIcon name={item.icon} />
              <span className="visually-hidden">{dirNames[item.dir]}</span>
            </Radio>
          ))}
        </div>
      </RadioGroup>
      {actions ? <div className="ed-actions">{actions}</div> : null}
    </aside>
  );
}
