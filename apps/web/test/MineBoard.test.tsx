import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
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
    expect(container.querySelector('use[href="#ms-sparkle"]')).not.toBeNull();
  });

  test("szerkesztéskor Enter és Szóköz fest, a számbillentyű eszközt vált", () => {
    const onPaint = vi.fn();
    const onShortcut = vi.fn((key: string) => key === "2");
    render(
      <MineBoard
        map={corridorMap}
        robot={robot}
        label="Szerkesztő"
        size="editor"
        onPaint={onPaint}
        onShortcut={onShortcut}
      />,
    );
    const grid = screen.getByRole("grid", { name: "Szerkesztő" });
    expect(grid.getAttribute("aria-readonly")).toBe("false");
    const first = screen.getAllByRole("gridcell")[0] as HTMLElement;
    first.focus();
    fireEvent.keyDown(first, { key: "ArrowRight" });
    fireEvent.keyDown(document.activeElement as HTMLElement, { key: "Enter" });
    expect(onPaint).toHaveBeenLastCalledWith({ row: 0, col: 1 });
    fireEvent.keyDown(document.activeElement as HTMLElement, { key: " " });
    expect(onPaint).toHaveBeenCalledTimes(2);
    fireEvent.keyDown(document.activeElement as HTMLElement, { key: "2" });
    expect(onShortcut).toHaveBeenCalledWith("2");
    expect(onPaint).toHaveBeenCalledTimes(2);
  });

  test("egérrel húzva több mezőt fest, mindegyiket egyszer", () => {
    const onPaint = vi.fn();
    render(<MineBoard map={corridorMap} robot={robot} label="Húzás" onPaint={onPaint} />);
    const cells = screen.getAllByRole("gridcell");
    const target = cells[2] as HTMLElement;
    document.elementFromPoint = vi.fn(() => target);
    fireEvent.pointerDown(cells[1] as HTMLElement, { button: 0 });
    fireEvent.pointerMove(target, { clientX: 5, clientY: 5 });
    fireEvent.pointerMove(target, { clientX: 6, clientY: 5 });
    fireEvent.pointerUp(window);
    fireEvent.pointerMove(cells[3] as HTMLElement, { clientX: 9, clientY: 5 });
    expect(onPaint.mock.calls).toEqual([[{ row: 0, col: 1 }], [{ row: 0, col: 2 }]]);
  });

  test("olvasható nézetben a mutató nem fest, a jobb gomb sem", async () => {
    const onPaint = vi.fn();
    const user = userEvent.setup();
    render(<MineBoard map={corridorMap} robot={robot} label="Csak nézet" />);
    await user.click(screen.getAllByRole("gridcell")[2] as HTMLElement);
    render(<MineBoard map={corridorMap} robot={robot} label="Jobb gomb" onPaint={onPaint} />);
    const grid = screen.getByRole("grid", { name: "Jobb gomb" });
    fireEvent.pointerDown(grid.querySelector("td") as HTMLElement, { button: 2 });
    expect(onPaint).not.toHaveBeenCalled();
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
