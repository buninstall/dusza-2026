import type { Cell, DiagCode, Diagnostic, Dir, MapInfo, MineMap, Pos } from "@minescript/engine";
import { diagnosticMessage } from "./messages.ts";
import { digitsValue, MAX_MAP_SIZE, type SourceLine, spanOf, splitLines } from "./source.ts";

export type MapCheck = { map: MineMap | null; diagnostics: Diagnostic[]; info: MapInfo | null };

const CELLS: ReadonlyMap<string, Cell> = new Map([
  [".", "empty"],
  ["@", "gold"],
  ["#", "wall"],
  [">", "empty"],
  ["<", "empty"],
  ["^", "empty"],
  ["v", "empty"],
]);

const ROBOTS: ReadonlyMap<string, Dir> = new Map([
  [">", "east"],
  ["<", "west"],
  ["^", "north"],
  ["v", "south"],
]);

const HEADER_PATTERN = /^([0-9]+) ([0-9]+)$/;

const NEIGHBOURS: readonly (readonly [number, number])[] = [
  [-1, 0],
  [0, 1],
  [1, 0],
  [0, -1],
];

function mapDiagnostic(
  code: DiagCode,
  line: SourceLine,
  col = 1,
  length = line.text.length,
  severity: Diagnostic["severity"] = "error",
): Diagnostic {
  return {
    code,
    severity,
    span: spanOf(line, col, length),
    message: diagnosticMessage(code),
    help: null,
    fixes: [],
  };
}

function inRange(value: number): boolean {
  return value >= 1 && value <= MAX_MAP_SIZE;
}

type Robot = { pos: Pos; dir: Dir };

function checkRow(
  line: SourceLine,
  cols: number,
  row: number,
  robots: Robot[],
  diagnostics: Diagnostic[],
): Cell[] {
  const cells: Cell[] = [];
  let badSymbol: { at: number; length: number } | null = null;
  let utf16 = 0;
  Array.from(line.text).forEach((symbol, col) => {
    const dir = ROBOTS.get(symbol);
    if (dir) {
      robots.push({ pos: { row, col }, dir });
      if (robots.length === 2)
        diagnostics.push(mapDiagnostic("MAP_MULTIPLE_ROBOTS", line, utf16 + 1, 1));
    }
    const cell = CELLS.get(symbol);
    if (!cell && !badSymbol) badSymbol = { at: utf16, length: symbol.length };
    cells.push(cell ?? "empty");
    utf16 += symbol.length;
  });
  if (badSymbol) {
    const { at, length } = badSymbol;
    diagnostics.push(mapDiagnostic("MAP_BAD_SYMBOL", line, at + 1, length));
  }
  else if (cells.length !== cols) diagnostics.push(mapDiagnostic("MAP_ROW_LENGTH", line));
  return cells;
}

export function mapInfo(map: MineMap): MapInfo {
  const seen = new Set<number>([map.robot.row * MAX_MAP_SIZE + map.robot.col]);
  const queue: Pos[] = [map.robot];
  for (let head = 0; head < queue.length; head += 1) {
    const pos = queue[head] as Pos;
    for (const [dr, dc] of NEIGHBOURS) {
      const next = { row: pos.row + dr, col: pos.col + dc };
      const key = next.row * MAX_MAP_SIZE + next.col;
      const cell = map.cells[next.row]?.[next.col];
      if (!cell || cell === "wall" || seen.has(key)) continue;
      seen.add(key);
      queue.push(next);
    }
  }
  const gold: Pos[] = [];
  map.cells.forEach((cells, row) => {
    cells.forEach((cell, col) => {
      if (cell === "gold") gold.push({ row, col });
    });
  });
  const unreachable = gold.filter((pos) => !seen.has(pos.row * MAX_MAP_SIZE + pos.col));
  return { goldTotal: gold.length, reachableGold: gold.length - unreachable.length, unreachable };
}

function warningsOf(info: MapInfo, lines: readonly SourceLine[]): Diagnostic[] {
  const header = lines[0] as SourceLine;
  if (info.goldTotal === 0) return [mapDiagnostic("MAP_NO_GOLD", header, 1, 0, "warning")];
  return info.unreachable.map((pos) =>
    mapDiagnostic("MAP_UNREACHABLE_GOLD", lines[pos.row + 1] ?? header, pos.col + 1, 1, "warning"),
  );
}

function invalid(diagnostics: Diagnostic[]): MapCheck {
  return { map: null, diagnostics, info: null };
}

export function parseMapText(text: string): MapCheck {
  const lines = splitLines(text);
  const header = lines[0];
  if (!header) {
    return invalid([mapDiagnostic("MAP_EMPTY", { number: 1, text: "", offset: 0 })]);
  }
  const match = HEADER_PATTERN.exec(header.text);
  if (!match) return invalid([mapDiagnostic("MAP_HEADER", header)]);
  const rows = digitsValue(match[1] ?? "");
  const cols = digitsValue(match[2] ?? "");
  if (!inRange(rows) || !inRange(cols)) return invalid([mapDiagnostic("MAP_DIM_RANGE", header)]);
  const diagnostics: Diagnostic[] = [];
  const rowLines = lines.slice(1);
  if (rowLines.length !== rows) {
    const firstExtraRow = rowLines.length > rows ? lines[rows + 1] : undefined;
    diagnostics.push(mapDiagnostic("MAP_ROW_COUNT", firstExtraRow ?? header));
  }
  const robots: Robot[] = [];
  const cells = rowLines
    .slice(0, rows)
    .map((line, row) => checkRow(line, cols, row, robots, diagnostics));
  const robot = robots[0];
  if (!robot) diagnostics.push(mapDiagnostic("MAP_NO_ROBOT", header));
  diagnostics.sort((a, b) => a.span.line - b.span.line || a.span.colStart - b.span.colStart);
  if (!robot || diagnostics.length > 0) return invalid(diagnostics);
  const map: MineMap = { rows, cols, cells, robot: robot.pos, dir: robot.dir };
  const info = mapInfo(map);
  return { map, diagnostics: warningsOf(info, lines), info };
}
