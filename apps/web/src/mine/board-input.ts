import type { Pos } from "@minescript/engine";
import {
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type RefObject,
  useRef,
  useState,
} from "react";
import { clampPos, moveFocus } from "./grid-nav.ts";

export type StrokeKind = "paint" | "erase";

export type BoardInteraction = {
  cursor: Pos;
  onCursorChange: (pos: Pos) => void;
  onKey: (event: KeyboardEvent<HTMLElement>, pos: Pos) => boolean;
  onNavigate?: (pos: Pos, isShift: boolean) => void;
  onKeyUp?: (event: KeyboardEvent<HTMLElement>) => void;
  onStrokeStart: (pos: Pos, kind: StrokeKind, isShift: boolean) => void;
  onStrokeMove: (pos: Pos) => void;
  onStrokeEnd: () => void;
  onHover?: (pos: Pos | null) => void;
};

const PRIMARY = 0;
const SECONDARY = 2;

function cellPos(element: Element | null): Pos | null {
  const cell = element?.closest<HTMLElement>("[data-row]");
  if (!cell) {
    return null;
  }
  return { row: Number(cell.dataset.row), col: Number(cell.dataset.col) };
}

function sameCell(a: Pos | null, b: Pos | null): boolean {
  return a !== null && b !== null && a.row === b.row && a.col === b.col;
}

type InputSetup = {
  gridRef: RefObject<HTMLTableElement | null>;
  rows: number;
  cols: number;
  interaction: BoardInteraction | undefined;
};

export function useBoardInput({ gridRef, rows, cols, interaction }: InputSetup) {
  const [ownFocus, setOwnFocus] = useState<Pos>({ row: 0, col: 0 });
  const lastCell = useRef<Pos | null>(null);
  const focus = clampPos(interaction?.cursor ?? ownFocus, rows, cols);

  const setFocus = (pos: Pos) => {
    setOwnFocus(pos);
    interaction?.onCursorChange(pos);
  };

  const focusCell = (pos: Pos) => {
    setFocus(pos);
    gridRef.current
      ?.querySelector<HTMLElement>(`[data-row="${pos.row}"][data-col="${pos.col}"]`)
      ?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTableElement>) => {
    if (interaction?.onKey(event, focus)) {
      event.preventDefault();
      return;
    }
    const target = moveFocus(event, focus, rows, cols);
    if (target) {
      event.preventDefault();
      focusCell(target);
      interaction?.onNavigate?.(target, event.shiftKey);
    }
  };

  const onPointerDown = (event: PointerEvent<HTMLTableElement>) => {
    const pos = cellPos(event.target as Element);
    const isKnownButton = event.button === PRIMARY || event.button === SECONDARY;
    if (!interaction || !pos || !isKnownButton) {
      return;
    }
    event.preventDefault();
    lastCell.current = pos;
    focusCell(pos);
    interaction.onStrokeStart(pos, event.button === SECONDARY ? "erase" : "paint", event.shiftKey);
    const end = () => {
      lastCell.current = null;
      gridRef.current?.removeAttribute("data-painting");
      interaction.onStrokeEnd();
    };
    gridRef.current?.setAttribute("data-painting", "true");
    window.addEventListener("pointerup", end, { once: true });
    window.addEventListener("pointercancel", end, { once: true });
  };

  const onPointerMove = (event: PointerEvent<HTMLTableElement>) => {
    if (!interaction) {
      return;
    }
    const pos = cellPos(document.elementFromPoint(event.clientX, event.clientY));
    interaction.onHover?.(pos);
    if (
      !gridRef.current?.hasAttribute("data-painting") ||
      !pos ||
      sameCell(pos, lastCell.current)
    ) {
      return;
    }
    lastCell.current = pos;
    interaction.onStrokeMove(pos);
  };

  return {
    focus,
    setFocus,
    handlers: interaction
      ? {
          onKeyDown,
          onKeyUp: (event: KeyboardEvent<HTMLTableElement>) => interaction.onKeyUp?.(event),
          onPointerDown,
          onPointerMove,
          onPointerLeave: () => interaction.onHover?.(null),
          onContextMenu: (event: MouseEvent<HTMLTableElement>) => event.preventDefault(),
        }
      : {
          onKeyDown: (event: KeyboardEvent<HTMLTableElement>) => {
            const target = moveFocus(event, focus, rows, cols);
            if (target) {
              event.preventDefault();
              focusCell(target);
            }
          },
        },
  };
}
