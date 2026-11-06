import type {
  Analysis,
  Assignment,
  Diagnostic,
  Dir,
  Event,
  FoldRange,
  Outcome,
  Pos,
  RobotState,
  RunResult,
  SemanticToken,
  SemanticTokenKind,
  SymbolInfo,
} from "./generated/index.ts";

const DIRS: readonly Dir[] = ["north", "east", "south", "west"];
const TOKEN_KINDS: readonly SemanticTokenKind[] = [
  "keyword",
  "number",
  "bool",
  "operator",
  "variable",
  "invalid",
];
const MINED = 1;
const PRINTED = 2;
const ASSIGNED = 4;

export type RunSummary = {
  outcome: Outcome;
  gold: number;
  steps: number;
  console: string[];
  finalRobot: RobotState;
  discovered: Pos[];
  names: string[];
};

export type AnalysisSummary = {
  diagnostics: Diagnostic[];
  folds: FoldRange[];
  symbols: SymbolInfo[];
};

function positions(data: Float64Array, at: number): [Pos[], number] {
  const count = data[at] ?? 0;
  const cells: Pos[] = new Array(count);
  let cursor = at + 1;
  for (let item = 0; item < count; item++) {
    cells[item] = { row: data[cursor] ?? 0, col: data[cursor + 1] ?? 0 };
    cursor += 2;
  }
  return [cells, cursor];
}

export function decodeRun(summary: RunSummary, data: Float64Array): RunResult {
  const events: Event[] = [];
  let printed = 0;
  let at = 0;
  while (at < data.length) {
    const index = data[at] ?? 0;
    const line = data[at + 1] ?? 0;
    const robot: RobotState = {
      pos: { row: data[at + 2] ?? 0, col: data[at + 3] ?? 0 },
      dir: DIRS[data[at + 4] ?? 0] ?? "east",
    };
    const gold = data[at + 5] ?? 0;
    const steps = data[at + 6] ?? 0;
    const flags = data[at + 7] ?? 0;
    const [path, afterPath] = positions(data, at + 8);
    const [discovered, afterDiscovered] = positions(data, afterPath);
    at = afterDiscovered;
    let mined: Pos | null = null;
    if (flags & MINED) {
      mined = { row: data[at] ?? 0, col: data[at + 1] ?? 0 };
      at += 2;
    }
    let print: string | null = null;
    if (flags & PRINTED) {
      print = summary.console[printed] ?? "";
      printed += 1;
    }
    let assigned: Assignment | null = null;
    if (flags & ASSIGNED) {
      const name = summary.names[data[at] ?? 0] ?? "";
      const raw = data[at + 2] ?? 0;
      assigned = {
        name,
        value:
          data[at + 1] === 0 ? { kind: "int", value: raw } : { kind: "bool", value: raw !== 0 },
      };
      at += 3;
    }
    events.push({ index, line, robot, path, discovered, mined, gold, steps, print, assigned });
  }
  return {
    outcome: summary.outcome,
    events,
    gold: summary.gold,
    steps: summary.steps,
    console: summary.console,
    finalRobot: summary.finalRobot,
    discovered: summary.discovered,
  };
}

export function decodeAnalysis(summary: AnalysisSummary, data: Uint32Array): Analysis {
  const count = Math.floor(data.length / 3);
  const tokens: SemanticToken[] = new Array(count);
  for (let item = 0, at = 0; item < count; item++, at += 3) {
    tokens[item] = {
      from: data[at] ?? 0,
      to: data[at + 1] ?? 0,
      kind: TOKEN_KINDS[data[at + 2] ?? 0] ?? "invalid",
    };
  }
  return {
    diagnostics: summary.diagnostics,
    tokens,
    folds: summary.folds,
    symbols: summary.symbols,
  };
}
