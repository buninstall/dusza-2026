import type { Pos } from "@minescript/engine";
import type { ComponentProps } from "react";
import { MineBoard } from "../MineBoard.tsx";
import "./MineScene.css";

export type SceneLighting = "open" | "lamp" | "dark" | "work";
export type PanButton = "primary" | "secondary";

export type MineSceneProps = Omit<ComponentProps<typeof MineBoard>, "fit" | "size"> & {
  lighting: SceneLighting;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  follow?: Pos | null;
  panButton?: PanButton;
};

export function MineScene({
  lighting,
  zoom,
  onZoomChange: _onZoomChange,
  follow: _follow = null,
  panButton = "primary",
  ...board
}: MineSceneProps) {
  return (
    <div
      className="mine-scene"
      data-lighting={lighting}
      data-pan={panButton}
      data-zoomed={zoom > 1}
    >
      <MineBoard {...board} fit="both" />
    </div>
  );
}
