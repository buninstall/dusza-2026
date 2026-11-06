import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { MapGrid } from "../src/map/MapGrid.tsx";
import { tinyMap } from "./fixtures.ts";

describe("MapGrid", () => {
  test("rács, sor és cella szerepkörök magyar címkékkel", () => {
    render(
      <MapGrid
        map={tinyMap}
        mode="view"
        label="Teszt térkép"
        robot={{ pos: { row: 0, col: 0 }, dir: "east" }}
      />,
    );
    const grid = screen.getByRole("grid", { name: "Teszt térkép" });
    expect(grid.getAttribute("aria-rowcount")).toBe("2");
    expect(screen.getAllByRole("row")).toHaveLength(2);
    expect(screen.getAllByRole("gridcell")).toHaveLength(6);
    expect(
      screen.getByRole("gridcell", { name: "1. sor, 1. oszlop: robot, kelet felé" }),
    ).toBeTruthy();
    expect(screen.getByRole("gridcell", { name: "1. sor, 2. oszlop: arany" })).toBeTruthy();
    expect(screen.getByRole("gridcell", { name: "1. sor, 3. oszlop: fal" })).toBeTruthy();
  });

  test("nyílbillentyűs navigáció roving tabindexszel", () => {
    render(<MapGrid map={tinyMap} mode="view" label="Navigáció" robot={null} />);
    const first = screen.getByRole("gridcell", { name: "1. sor, 1. oszlop: üres kamra" });
    expect(first.tabIndex).toBe(0);
    first.focus();
    fireEvent.keyDown(first, { key: "ArrowRight" });
    const second = screen.getByRole("gridcell", { name: "1. sor, 2. oszlop: arany" });
    expect(document.activeElement).toBe(second);
    fireEvent.keyDown(second, { key: "ArrowDown" });
    expect(document.activeElement).toBe(
      screen.getByRole("gridcell", { name: "2. sor, 2. oszlop: üres kamra" }),
    );
    fireEvent.keyDown(document.activeElement as Element, { key: "End" });
    expect(document.activeElement).toBe(
      screen.getByRole("gridcell", { name: "2. sor, 3. oszlop: arany" }),
    );
    fireEvent.keyDown(document.activeElement as Element, { key: "Home", ctrlKey: true });
    expect(document.activeElement).toBe(first);
  });

  test("ködös módban a felderítetlen mező rejtett", () => {
    render(
      <MapGrid
        map={tinyMap}
        mode="fog"
        label="Köd"
        robot={{ pos: { row: 0, col: 0 }, dir: "east" }}
        discovered={new Set(["0:0", "0:1"])}
      />,
    );
    expect(screen.getByRole("gridcell", { name: "1. sor, 2. oszlop: arany" })).toBeTruthy();
    expect(screen.getByRole("gridcell", { name: "1. sor, 3. oszlop: felderítetlen" })).toBeTruthy();
  });

  test("a kibányászott arany üres kamrának látszik", () => {
    render(
      <MapGrid map={tinyMap} mode="view" label="Bánya" robot={null} mined={new Set(["0:1"])} />,
    );
    expect(screen.getByRole("gridcell", { name: "1. sor, 2. oszlop: üres kamra" })).toBeTruthy();
  });

  test("szerkesztő módban gombok aktiválják a cellát", async () => {
    const onCellActivate = vi.fn();
    const user = userEvent.setup();
    render(
      <MapGrid map={tinyMap} mode="edit" label="Szerkesztő" onCellActivate={onCellActivate} />,
    );
    const target = screen.getByRole("button", { name: "2. sor, 3. oszlop: arany" });
    await user.click(target);
    expect(onCellActivate).toHaveBeenCalledWith({ row: 1, col: 2 });
    const first = screen.getByRole("button", { name: "1. sor, 1. oszlop: robot, kelet felé" });
    first.focus();
    await user.keyboard("{ArrowDown}{Enter}");
    expect(onCellActivate).toHaveBeenLastCalledWith({ row: 1, col: 0 });
  });
});
