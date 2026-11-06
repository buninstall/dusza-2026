import type { Pos, RobotState } from "@minescript/engine";
import type { CSSProperties } from "react";
import { SPRITE_ID, TILE_SIZE } from "../pixel/tiles.ts";
import "./MineBoard.css";
import { useQuarterTurns } from "./quarter-turns.ts";

function placement(pos: Pos): CSSProperties {
  return { "--row": pos.row, "--col": pos.col } as CSSProperties;
}

function SpriteUse({ id, className }: { id: string; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox={`0 0 ${TILE_SIZE} ${TILE_SIZE}`}
      shapeRendering="crispEdges"
      className={className}
    >
      <use href={`#${id}`} />
    </svg>
  );
}

export function RobotLayer({ robot }: { robot: RobotState }) {
  const turns = useQuarterTurns(robot.dir);
  return (
    <div className="board-robot" style={placement(robot.pos)} data-testid="robot">
      <div className="board-robot-body" style={{ "--turns": turns } as CSSProperties}>
        <SpriteUse id={SPRITE_ID.robot} className="board-tile-art" />
      </div>
    </div>
  );
}

export function SparkleBurst({ pos }: { pos: Pos }) {
  return (
    <div className="board-sparkle" style={placement(pos)}>
      <SpriteUse id={SPRITE_ID.sparkle} className="board-tile-art" />
    </div>
  );
}
