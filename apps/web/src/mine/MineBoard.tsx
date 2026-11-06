import type { MineMap, Pos, RobotState } from "@minescript/engine";
import {
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  useMemo,
  useRef,
  useState,
} from "react";
import { clampPos, moveFocus, samePos } from "./grid-nav.ts";
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
  onPaint?: ((pos: Pos) => void) | undefined;
  onShortcut?: ((key: string) => boolean) | undefined;
};

const PAINT_KEYS = new Set(["Enter", " "]);
const NO_MARKS: ReadonlyMap<string, string> = new Map();

export function tileMaxFor(map: MineMap): number {
  const longest = Math.max(map.rows, map.cols);
  if (longest <= 5) {
    return 96;
  }
  return longest <= 8 ? 80 : 64;
}

function cellPos(element: Element | null): Pos | null {
  const cell = element?.closest<HTMLElement>("[data-row]");
  if (!cell) {
    return null;
  }
  return { row: Number(cell.dataset.row), col: Number(cell.dataset.col) };
}

function Rulers({ rows, cols }: { rows: number; cols: number }) {
  return (
    <>
      <span aria-hidden="true" className="board-corner" />
      <span aria-hidden="true" className="board-ruler-top">
        {Array.from({ length: cols }, (_, col) => (
          <span key={`c${col.toString()}`}>{col + 1}</span>
        ))}
      </span>
      <span aria-hidden="true" className="board-ruler-left">
        {Array.from({ length: rows }, (_, row) => (
          <span key={`r${row.toString()}`}>{row + 1}</span>
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
  onPaint,
  onShortcut,
}: MineBoardProps) {
  const tiles = useMemo(() => buildTiles(map, robot, exploration), [map, robot, exploration]);
  const [focus, setFocus] = useState<Pos>({ row: 0, col: 0 });
  const gridRef = useRef<HTMLTableElement>(null);
  const lastPainted = useRef<string | null>(null);
  const safeFocus = clampPos(focus, map.rows, map.cols);
  const isEditable = onPaint !== undefined;

  const focusCell = (pos: Pos) => {
    setFocus(pos);
    gridRef.current
      ?.querySelector<HTMLElement>(`[data-row="${pos.row}"][data-col="${pos.col}"]`)
      ?.focus();
  };

  const paintAt = (pos: Pos | null) => {
    if (!onPaint || pos === null || posKey(pos) === lastPainted.current) {
      return;
    }
    lastPainted.current = posKey(pos);
    onPaint(pos);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTableElement>) => {
    const target = moveFocus(event, safeFocus, map.rows, map.cols);
    if (target) {
      event.preventDefault();
      focusCell(target);
      return;
    }
    if (onShortcut?.(event.key)) {
      event.preventDefault();
      return;
    }
    if (onPaint && PAINT_KEYS.has(event.key)) {
      event.preventDefault();
      onPaint(safeFocus);
    }
  };

  const handlePointerDown = (event: PointerEvent<HTMLTableElement>) => {
    if (!isEditable || event.button !== 0) {
      return;
    }
    const pos = cellPos(event.target as Element);
    if (!pos) {
      return;
    }
    lastPainted.current = null;
    focusCell(pos);
    paintAt(pos);
    const stop = () => {
      lastPainted.current = null;
      gridRef.current?.removeAttribute("data-painting");
    };
    gridRef.current?.setAttribute("data-painting", "true");
    window.addEventListener("pointerup", stop, { once: true });
    window.addEventListener("pointercancel", stop, { once: true });
  };

  const handlePointerMove = (event: PointerEvent<HTMLTableElement>) => {
    if (!gridRef.current?.hasAttribute("data-painting")) {
      return;
    }
    paintAt(cellPos(document.elementFromPoint(event.clientX, event.clientY)));
  };

  const boardStyle = {
    "--rows": map.rows,
    "--cols": map.cols,
    "--step-ms": `${stepMs}ms`,
    "--tile-max": `${tileMaxFor(map)}px`,
  } as CSSProperties;

  return (
    <div className="board-viewport" data-fit={fit}>
      <div className="board" style={boardStyle} data-size={size} data-fit={fit}>
        <Rulers rows={map.rows} cols={map.cols} />
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
            onKeyDown={handleKeyDown}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
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
                        tabIndex={samePos(view.pos, safeFocus) ? 0 : -1}
                        data-row={view.pos.row}
                        data-col={view.pos.col}
                        data-mark={cellMarks.get(key)}
                        className="board-cell"
                        onFocus={() => setFocus(view.pos)}
                      >
                        <TileArt view={view} />
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
      </div>
    </div>
  );
}
