import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import type { BoardInteraction } from "../src/mine/board-input.ts";
import { MapPreview } from "../src/mine/MapPreview.tsx";
import { MineBoard } from "../src/mine/MineBoard.tsx";
import { SpriteSheet } from "../src/pixel/SpriteSheet.tsx";
import { corridorMap, corridorStart } from "./support/fixtures.ts";

const robot = corridorStart;

describe("MineBoard", () => {
  test("adatrács szemantika magyar cellacímkékkel", () => {
    render(<MineBoard map={corridorMap} robot={robot} label="Folyosó térképe" />);
    const grid = screen.getByRole("grid", { name: "Folyosó térképe" });
    expect(grid.getAttribute("aria-rowcount")).toBe("1");
    expect(grid.getAttribute("aria-colcount")).toBe("4");
    expect(grid.getAttribute("aria-readonly")).toBe("true");
    expect(screen.getAllByRole("gridcell")).toHaveLength(4);
    expect(
      screen.getByRole("gridcell", { name: "1. sor, 1. oszlop: robot, kelet felé" }),
    ).toBeTruthy();
    expect(screen.getByRole("gridcell", { name: "1. sor, 3. oszlop: arany" })).toBeTruthy();
    expect(screen.getByRole("gridcell", { name: "1. sor, 4. oszlop: fal" })).toBeTruthy();
    expect(screen.getByTestId("robot").getAttribute("style")).toContain("--col: 0");
  });

  test("roving tabindex: egyetlen tabulátor-megálló, nyilakkal mozog", () => {
    render(<MineBoard map={corridorMap} robot={null} label="Rács" />);
    const cells = screen.getAllByRole("gridcell");
    expect(cells.map((cell) => cell.tabIndex)).toEqual([0, -1, -1, -1]);
    cells[0]?.focus();
    fireEvent.keyDown(cells[0] as HTMLElement, { key: "ArrowRight" });
    expect(document.activeElement).toBe(cells[1]);
    fireEvent.keyDown(cells[1] as HTMLElement, { key: "End" });
    expect(document.activeElement).toBe(cells[3]);
    fireEvent.keyDown(cells[3] as HTMLElement, { key: "Home", ctrlKey: true });
    expect(document.activeElement).toBe(cells[0]);
    expect(cells[0]?.tabIndex).toBe(0);
  });

  test("lámpafényben a felderítetlen mező címkéje és a szikra", () => {
    const { container } = render(
      <MineBoard
        map={corridorMap}
        robot={robot}
        label="Köd"
        exploration={{ discovered: new Set(["0:0", "0:1"]), mined: new Set(), mode: "lamp" }}
        sparkle={{ pos: { row: 0, col: 1 }, key: 3 }}
        stepMs={120}
      />,
    );
    expect(screen.getByRole("gridcell", { name: "1. sor, 3. oszlop: felderítetlen" })).toBeTruthy();
    expect(screen.getByRole("gridcell", { name: "1. sor, 2. oszlop: üres kamra" })).toBeTruthy();
    expect(container.querySelector('use[href="#ms-fringe-west"]')).not.toBeNull();
    expect(container.querySelector('use[href="#ms-burst-0"]')).not.toBeNull();
  });

  function interaction(overrides: Partial<BoardInteraction> = {}): BoardInteraction {
    return {
      cursor: { row: 0, col: 0 },
      onCursorChange: vi.fn(),
      onKey: vi.fn(() => false),
      onNavigate: vi.fn(),
      onKeyUp: vi.fn(),
      onStrokeStart: vi.fn(),
      onStrokeMove: vi.fn(),
      onStrokeEnd: vi.fn(),
      onHover: vi.fn(),
      ...overrides,
    };
  }

  test("szerkesztéskor a billentyűt előbb a szerkesztő kapja, a nyíl a kurzort viszi", () => {
    const onKey = vi.fn((event: { key: string }) => event.key === "Enter");
    const handlers = interaction({ onKey });
    render(
      <MineBoard
        map={corridorMap}
        robot={robot}
        label="Szerkesztő"
        size="editor"
        interaction={handlers}
        edges={{ end: <span>vég</span>, bottom: <span>alj</span> }}
        rulerMarks={{ rows: new Set([0]), cols: new Set([2]) }}
      />,
    );
    const grid = screen.getByRole("grid", { name: "Szerkesztő" });
    expect(grid.getAttribute("aria-readonly")).toBe("false");
    const first = screen.getAllByRole("gridcell")[0] as HTMLElement;
    first.focus();
    fireEvent.keyDown(first, { key: "Enter" });
    expect(onKey).toHaveBeenCalledOnce();
    fireEvent.keyDown(first, { key: "ArrowRight", shiftKey: true });
    expect(handlers.onNavigate).toHaveBeenCalledWith({ row: 0, col: 1 }, true);
    expect(handlers.onCursorChange).toHaveBeenCalledWith({ row: 0, col: 1 });
    fireEvent.keyUp(first, { key: "Shift" });
    expect(handlers.onKeyUp).toHaveBeenCalled();
    expect(screen.getByText("vég")).toBeTruthy();
    expect(document.querySelector('[data-flag="true"]')?.textContent).toBe("3");
  });

  test("egérrel húzva a vonás minden mezőt egyszer jelent, a jobb gomb töröl", () => {
    const handlers = interaction();
    render(<MineBoard map={corridorMap} robot={robot} label="Húzás" interaction={handlers} />);
    const cells = screen.getAllByRole("gridcell");
    const target = cells[2] as HTMLElement;
    document.elementFromPoint = vi.fn(() => target);
    fireEvent.pointerDown(cells[1] as HTMLElement, { button: 0 });
    expect(handlers.onStrokeStart).toHaveBeenCalledWith({ row: 0, col: 1 }, "paint", false);
    fireEvent.pointerMove(target, { clientX: 5, clientY: 5 });
    fireEvent.pointerMove(target, { clientX: 6, clientY: 5 });
    fireEvent.pointerUp(window);
    expect(handlers.onStrokeMove).toHaveBeenCalledOnce();
    expect(handlers.onStrokeEnd).toHaveBeenCalledOnce();
    fireEvent.pointerDown(cells[3] as HTMLElement, { button: 2 });
    expect(handlers.onStrokeStart).toHaveBeenLastCalledWith({ row: 0, col: 3 }, "erase", false);
    fireEvent.pointerUp(window);
    fireEvent.pointerLeave(screen.getByRole("grid"));
    expect(handlers.onHover).toHaveBeenLastCalledWith(null);
    fireEvent.contextMenu(cells[1] as HTMLElement);
  });

  test("olvasható nézetben a mutató nem jelent vonást, a nyíl mozgat", async () => {
    const user = userEvent.setup();
    render(<MineBoard map={corridorMap} robot={robot} label="Csak nézet" />);
    await user.click(screen.getAllByRole("gridcell")[2] as HTMLElement);
    const cell = screen.getAllByRole("gridcell")[0] as HTMLElement;
    cell.focus();
    fireEvent.keyDown(cell, { key: "End" });
    expect(document.activeElement?.getAttribute("data-col")).toBe("3");
    fireEvent.keyDown(document.activeElement as HTMLElement, { key: "x" });
  });
});

describe("sprite-lap és előnézet", () => {
  test("a sprite-lap minden csempét definiál", () => {
    const { container } = render(<SpriteSheet />);
    for (const id of [
      "ms-floor-0",
      "ms-wall-1",
      "ms-gold",
      "ms-robot",
      "ms-shroud",
      "ms-fringe-north",
    ]) {
      expect(container.querySelector(`symbol#${id}`)).not.toBeNull();
    }
    expect(container.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });

  test("az előnézet díszítő elem", () => {
    const { container } = render(<MapPreview content={"1 3\n>.@\n"} />);
    expect(container.firstElementChild?.getAttribute("aria-hidden")).toBe("true");
    expect(container.querySelectorAll("path").length).toBeGreaterThan(0);
  });
});
