import type { Pos, RobotState } from "@minescript/engine";
import type { CSSProperties } from "react";
import { PixelSprite } from "../pixel/SpriteLayers.tsx";
import { SPRITE_ID, TILE_SIZE, TILE_SPRITES } from "../pixel/tiles.ts";
import "./MineBoard.css";
import { useQuarterTurns } from "./quarter-turns.ts";

export type RobotMood = "run" | "ok" | "error" | "limit" | "stopped";

export type RobotMotion = {
  kind: "walk" | "mine" | "hop" | "shake" | "bump" | "still";
  key: number;
};

export function placement(pos: Pos): CSSProperties {
  return { "--row": pos.row, "--col": pos.col } as CSSProperties;
}

export function SpriteUse({ id, className }: { id: string; className?: string }) {
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

const ROBOT_TONES = {
  beam: "board-robot-beam",
  visor: "board-robot-visor",
  "tread-hi": "board-robot-tread",
} as const;

type RobotLayerProps = {
  robot: RobotState;
  mood?: RobotMood;
  motion?: RobotMotion;
  walkTiles?: number;
  isIdle?: boolean;
};

export function RobotLayer({
  robot,
  mood = "run",
  motion,
  walkTiles = 1,
  isIdle = false,
}: RobotLayerProps) {
  const turns = useQuarterTurns(robot.dir);
  const style = { ...placement(robot.pos), "--walk-steps": walkTiles * 4 } as CSSProperties;
  return (
    <div
      className="board-robot"
      style={style}
      data-testid="robot"
      data-mood={mood}
      data-idle={isIdle}
    >
      <div
        key={motion?.key ?? 0}
        className="board-robot-motion"
        data-motion={motion?.kind ?? "still"}
        data-dir={robot.dir}
      >
        <div className="board-robot-body" style={{ "--turns": turns } as CSSProperties}>
          <PixelSprite
            sprite={TILE_SPRITES.robot}
            className="board-tile-art"
            animated={ROBOT_TONES}
          />
        </div>
      </div>
    </div>
  );
}

export function SparkleBurst({ pos }: { pos: Pos }) {
  return (
    <div className="board-sparkle" style={placement(pos)}>
      {TILE_SPRITES.burst.map((_, frame) => (
        <SpriteUse
          key={SPRITE_ID.burst(frame)}
          id={SPRITE_ID.burst(frame)}
          className={`board-tile-art board-burst board-burst-${frame}`}
        />
      ))}
    </div>
  );
}
