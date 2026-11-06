import type { MineMap, Pos, RobotState } from "@minescript/engine";
import { clsx } from "clsx";
import { Gem, Navigation2 } from "lucide-react";
import { type KeyboardEvent, useCallback, useRef, useState } from "react";
import { type CellView, cellViews, describeCell, type GridMode, posKey } from "./cells.ts";

const ROTATION = { north: 0, east: 90, south: 180, west: 270 } as const;

type MapGridProps = {
  map: MineMap;
  mode: GridMode;
  label: string;
  robot?: RobotState | null;
  discovered?: ReadonlySet<string>;
  mined?: ReadonlySet<string>;
  onCellActivate?: (pos: Pos) => void;
};

function clamp(value: number, max: number): number {
  return Math.min(Math.max(value, 0), max);
}

function nextFocus(key: string, ctrl: boolean, focus: Pos, map: MineMap): Pos | null {
  const lastRow = map.rows - 1;
  const lastCol = map.cols - 1;
  switch (key) {
    case "ArrowUp":
      return { row: clamp(focus.row - 1, lastRow), col: focus.col };
    case "ArrowDown":
      return { row: clamp(focus.row + 1, lastRow), col: focus.col };
    case "ArrowLeft":
      return { row: focus.row, col: clamp(focus.col - 1, lastCol) };
    case "ArrowRight":
      return { row: focus.row, col: clamp(focus.col + 1, lastCol) };
    case "Home":
      return ctrl ? { row: 0, col: 0 } : { row: focus.row, col: 0 };
    case "End":
      return ctrl ? { row: lastRow, col: lastCol } : { row: focus.row, col: lastCol };
    default:
      return null;
  }
}

function CellContent({ view, robot }: { view: CellView; robot: RobotState | null }) {
  if (view.isHidden) {
    return null;
  }
  return (
    <>
      {view.cell === "gold" && !view.isMined ? (
        <Gem aria-hidden className="size-[55%] text-ore-deep" strokeWidth={2.25} />
      ) : null}
      {view.hasRobot && robot ? (
        <span className="absolute inset-[12%] flex items-center justify-center rounded-full bg-signal text-paper-raised shadow-[0_0_0_2px_var(--paper-raised)]">
          <Navigation2
            aria-hidden
            className="size-[62%] transition-transform duration-200"
            fill="currentColor"
            style={{ transform: `rotate(${ROTATION[robot.dir]}deg)` }}
          />
        </span>
      ) : null}
    </>
  );
}

function cellClass(view: CellView): string {
  if (view.isHidden) {
    return "cell-fog";
  }
  const visible = view.isMined ? "empty" : view.cell;
  return clsx(
    visible === "wall" && "cell-wall",
    visible === "gold" && "cell-gold",
    visible === "empty" && "bg-paper-raised",
    view.isDimmed && "opacity-45 saturate-50",
  );
}

export function MapGrid({
  map,
  mode,
  label,
  robot,
  discovered,
  mined,
  onCellActivate,
}: MapGridProps) {
  const effectiveRobot =
    robot !== undefined ? robot : mode === "edit" ? { pos: map.robot, dir: map.dir } : null;
  const views = cellViews(map, mode, effectiveRobot, discovered, mined);
  const [focus, setFocus] = useState<Pos>({ row: 0, col: 0 });
  const cellRefs = useRef(new Map<string, HTMLElement>());
  const safeFocus = { row: clamp(focus.row, map.rows - 1), col: clamp(focus.col, map.cols - 1) };
  const isEditable = mode === "edit" && onCellActivate !== undefined;

  const register = useCallback(
    (pos: Pos) => (element: HTMLElement | null) => {
      if (element) {
        cellRefs.current.set(posKey(pos), element);
      } else {
        cellRefs.current.delete(posKey(pos));
      }
    },
    [],
  );

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const target = nextFocus(event.key, event.ctrlKey || event.metaKey, safeFocus, map);
    if (!target) {
      return;
    }
    event.preventDefault();
    setFocus(target);
    cellRefs.current.get(posKey(target))?.focus();
  };

  return (
    <table
      role="grid"
      aria-label={label}
      aria-rowcount={map.rows}
      aria-colcount={map.cols}
      aria-readonly={!isEditable}
      className="w-full table-fixed border-separate border-spacing-px overflow-hidden rounded-[10px] border border-line-strong bg-line-strong"
      style={{ maxWidth: `${map.cols * 2.9}rem` }}
    >
      <tbody>
        {views.map((row, rowIndex) => (
          <tr key={`row-${rowIndex.toString()}`} aria-rowindex={rowIndex + 1}>
            {row.map((view) => {
              const isFocusTarget =
                view.pos.row === safeFocus.row && view.pos.col === safeFocus.col;
              const description = describeCell(view, effectiveRobot);
              const tileClass = clsx(
                "relative flex aspect-square items-center justify-center",
                cellClass(view),
              );
              if (isEditable) {
                return (
                  <td
                    key={posKey(view.pos)}
                    role="gridcell"
                    aria-colindex={view.pos.col + 1}
                    tabIndex={-1}
                    className="p-0"
                  >
                    <button
                      type="button"
                      ref={register(view.pos)}
                      aria-label={description}
                      tabIndex={isFocusTarget ? 0 : -1}
                      onKeyDown={onKeyDown}
                      onFocus={() => setFocus(view.pos)}
                      onClick={() => onCellActivate(view.pos)}
                      className={clsx(
                        tileClass,
                        "w-full outline-none hover:shadow-[inset_0_0_0_2px_var(--ink)] focus-visible:z-10 focus-visible:outline-3 focus-visible:outline-lamp",
                      )}
                    >
                      <CellContent view={view} robot={effectiveRobot} />
                    </button>
                  </td>
                );
              }
              return (
                <td
                  key={posKey(view.pos)}
                  role="gridcell"
                  aria-colindex={view.pos.col + 1}
                  aria-label={description}
                  tabIndex={isFocusTarget ? 0 : -1}
                  ref={register(view.pos)}
                  onKeyDown={onKeyDown}
                  onFocus={() => setFocus(view.pos)}
                  className="p-0 outline-none focus-visible:outline-3 focus-visible:outline-lamp"
                >
                  <div className={tileClass}>
                    <CellContent view={view} robot={effectiveRobot} />
                  </div>
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
