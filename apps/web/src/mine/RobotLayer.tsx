import type { Pos, RobotState } from "@minescript/engine";
import { type CSSProperties, useState } from "react";
import { PixelSprite } from "../pixel/SpriteLayers.tsx";
import { SPRITE_ID, TILE_SIZE, TILE_SPRITES } from "../pixel/tiles.ts";
import "./MineBoard.css";
import { useQuarterTurns } from "./quarter-turns.ts";

export type RobotMood = "run" | "ok" | "error" | "limit" | "stopped";

export type RobotMotion = {
  kind: "walk" | "mine" | "settle" | "shake" | "bump" | "still";
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
  tread: "board-robot-tread",
  "tread-hi": "board-robot-tread-hi",
} as const;

const TREAD_PHASE_MS = 90;

function treadCycles(stepMs: number): number {
  return Math.max(1, Math.round(stepMs / (TREAD_PHASE_MS * 2)));
}

type TurnSide = "none" | "left" | "right" | "back";

function useTurnDrift(turns: number): { side: TurnSide; key: number } {
  const [state, setState] = useState({ turns, side: "none" as TurnSide, key: 0 });
  if (state.turns !== turns) {
    const delta = turns - state.turns;
    const side: TurnSide = Math.abs(delta) >= 2 ? "back" : delta > 0 ? "right" : "left";
    const next = { turns, side, key: state.key + 1 };
    setState(next);
    return next;
  }
  return state;
}

type RobotLayerProps = {
  robot: RobotState;
  mood?: RobotMood;
  motion?: RobotMotion;
  walkTiles?: number;
  stepMs?: number;
  isIdle?: boolean;
  beam?: { isScan: boolean; key: string };
};

export function RobotLayer({
  robot,
  mood = "run",
  motion,
  walkTiles = 1,
  stepMs = 0,
  isIdle = false,
  beam,
}: RobotLayerProps) {
  const turns = useQuarterTurns(robot.dir);
  const drift = useTurnDrift(turns);
  const style = {
    ...placement(robot.pos),
    "--walk-tiles": walkTiles,
    "--tread-cycles": treadCycles(stepMs),
    "--tread-phase": `${TREAD_PHASE_MS * 2}ms`,
  } as CSSProperties;
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
        {beam ? (
          <div
            key={beam.key}
            className="board-robot-cone"
            data-scan={beam.isScan}
            style={{ "--turns": turns } as CSSProperties}
          >
            <SpriteUse id={SPRITE_ID.cone} className="board-fx-art" />
          </div>
        ) : null}
        <div className="board-robot-body" style={{ "--turns": turns } as CSSProperties}>
          <div key={drift.key} className="board-robot-drift" data-turn={drift.side}>
            <PixelSprite
              sprite={TILE_SPRITES.robot}
              className="board-tile-art"
              animated={ROBOT_TONES}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

const DEBRIS: readonly { dx: number; dy: number; tone: "rock" | "ore" }[] = [
  { dx: -0.55, dy: -0.5, tone: "rock" },
  { dx: 0.5, dy: -0.6, tone: "ore" },
  { dx: -0.7, dy: 0.05, tone: "ore" },
  { dx: 0.7, dy: -0.15, tone: "rock" },
  { dx: -0.25, dy: -0.8, tone: "ore" },
  { dx: 0.3, dy: 0.2, tone: "rock" },
  { dx: 0.05, dy: -0.95, tone: "rock" },
];

export function Chips({ tone }: { tone?: "spark" }) {
  return DEBRIS.map((chip, index) => (
    <span
      key={`chip-${index.toString()}`}
      className="board-chip"
      data-tone={tone ?? chip.tone}
      style={{ "--dx": chip.dx, "--dy": chip.dy } as CSSProperties}
    />
  ));
}

export function SparkleBurst({ pos }: { pos: Pos }) {
  return (
    <div className="board-sparkle" style={placement(pos)}>
      <Chips />
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
