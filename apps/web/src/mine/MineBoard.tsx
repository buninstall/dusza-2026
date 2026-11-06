import type { MineMap, Pos, RobotState } from "@minescript/engine";
import { type CSSProperties, type ReactNode, useMemo, useRef } from "react";
import { type BoardInteraction, useBoardInput } from "./board-input.ts";
import { samePos } from "./grid-nav.ts";
import "./MineBoard.css";
import { RobotLayer, type RobotMood, type RobotMotion, SparkleBurst } from "./RobotLayer.tsx";
import { TileArt } from "./TileArt.tsx";
import { buildTiles, describeTile, type Exploration, posKey } from "./tiles-model.ts";

export type BoardSize = "play" | "editor" | "scene";
export type BoardFit = "width" | "both";

export type Sparkle = { pos: Pos; key: number };

export type RobotLook = {
  mood?: RobotMood;
  motion?: RobotMotion;
  walkTiles?: number;
  isIdle?: boolean;
};

export type RulerMarks = { rows: ReadonlySet<number>; cols: ReadonlySet<number> };

export type BoardEdges = { end?: ReactNode; bottom?: ReactNode };

type MineBoardProps = {
  map: MineMap;
  robot: RobotState | null;
  label: string;
  describedBy?: string | undefined;
  exploration?: Exploration | null;
  sparkle?: Sparkle | null;
  stepMs?: number;
  size?: BoardSize;
  fit?: BoardFit;
  look?: RobotLook;
  overlay?: ReactNode;
  cellMarks?: ReadonlyMap<string, string>;
  cellNotes?: ReadonlyMap<string, string>;
  rulerMarks?: RulerMarks;
  edges?: BoardEdges;
  interaction?: BoardInteraction | undefined;
};

const NO_MARKS: ReadonlyMap<string, string> = new Map();
const NO_FLAGS: ReadonlySet<number> = new Set();

export function tileMaxFor(map: MineMap): number {
  const longest = Math.max(map.rows, map.cols);
  if (longest <= 5) {
    return 96;
  }
  return longest <= 8 ? 80 : 64;
}

function Rulers({
  rows,
  cols,
  marks,
}: {
  rows: number;
  cols: number;
  marks: RulerMarks | undefined;
}) {
  const flaggedRows = marks?.rows ?? NO_FLAGS;
  const flaggedCols = marks?.cols ?? NO_FLAGS;
  return (
    <>
      <span aria-hidden="true" className="board-corner" />
      <span aria-hidden="true" className="board-ruler-top">
        {Array.from({ length: cols }, (_, col) => (
          <span key={`c${col.toString()}`} data-flag={flaggedCols.has(col)}>
            {col + 1}
          </span>
        ))}
      </span>
      <span aria-hidden="true" className="board-ruler-left">
        {Array.from({ length: rows }, (_, row) => (
          <span key={`r${row.toString()}`} data-flag={flaggedRows.has(row)}>
            {row + 1}
          </span>
        ))}
      </span>
    </>
  );
}

export function MineBoard({
  map,
  robot,
  label,
  describedBy,
  exploration = null,
  sparkle = null,
  stepMs = 0,
  size = "play",
  fit = "width",
  look = {},
  overlay,
  cellMarks = NO_MARKS,
  cellNotes = NO_MARKS,
  rulerMarks,
  edges,
  interaction,
}: MineBoardProps) {
  const tiles = useMemo(() => buildTiles(map, robot, exploration), [map, robot, exploration]);
  const gridRef = useRef<HTMLTableElement>(null);
  const input = useBoardInput({ gridRef, rows: map.rows, cols: map.cols, interaction });
  const isEditable = interaction !== undefined;

  const boardStyle = {
    "--rows": map.rows,
    "--cols": map.cols,
    "--step-ms": `${stepMs}ms`,
    ...(size === "play" ? { "--tile-max": `${tileMaxFor(map)}px` } : {}),
  } as CSSProperties;

  return (
    <div className="board-viewport" data-fit={fit}>
      <div
        className="board"
        style={boardStyle}
        data-size={size}
        data-fit={fit}
        data-edges={edges !== undefined}
      >
        <Rulers rows={map.rows} cols={map.cols} marks={rulerMarks} />
        <div className="board-field">
          <table
            ref={gridRef}
            role="grid"
            aria-label={label}
            aria-describedby={describedBy}
            aria-rowcount={map.rows}
            aria-colcount={map.cols}
            aria-readonly={!isEditable}
            className="board-grid"
            data-editable={isEditable}
            {...input.handlers}
          >
            <tbody>
              {tiles.map((row, rowIndex) => (
                <tr key={`row-${rowIndex.toString()}`} aria-rowindex={rowIndex + 1}>
                  {row.map((view) => {
                    const key = posKey(view.pos);
                    return (
                      <td
                        key={key}
                        role="gridcell"
                        aria-colindex={view.pos.col + 1}
                        aria-label={describeTile(view, robot, cellNotes.get(key))}
                        tabIndex={samePos(view.pos, input.focus) ? 0 : -1}
                        data-row={view.pos.row}
                        data-col={view.pos.col}
                        data-mark={cellMarks.get(key)}
                        className="board-cell"
                        onFocus={() => input.setFocus(view.pos)}
                      >
                        <TileArt key={isEditable ? view.kind : "tile"} view={view} />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {overlay}
          {robot ? (
            <RobotLayer
              robot={robot}
              {...(look.mood ? { mood: look.mood } : {})}
              {...(look.motion ? { motion: look.motion } : {})}
              walkTiles={look.walkTiles ?? 1}
              isIdle={look.isIdle ?? false}
            />
          ) : null}
          {sparkle ? <SparkleBurst key={sparkle.key} pos={sparkle.pos} /> : null}
        </div>
        {edges?.end ? <div className="board-edge-end">{edges.end}</div> : null}
        {edges?.bottom ? <div className="board-edge-bottom">{edges.bottom}</div> : null}
      </div>
    </div>
  );
}
