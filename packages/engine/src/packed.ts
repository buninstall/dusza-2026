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

class Reader {
  at = 0;

  constructor(private readonly data: Float64Array) {}

  get done(): boolean {
    return this.at >= this.data.length;
  }

  next(): number {
    const value = this.data[this.at] ?? 0;
    this.at += 1;
    return value;
  }

  pos(): Pos {
    const row = this.next();
    return { row, col: this.next() };
  }

  positions(): Pos[] {
    const count = this.next();
    const cells: Pos[] = [];
    for (let item = 0; item < count; item++) {
      cells.push(this.pos());
    }
    return cells;
  }
}

export function decodeRun(summary: RunSummary, data: Float64Array): RunResult {
  const events: Event[] = [];
  const reader = new Reader(data);
  let printed = 0;
  while (!reader.done) {
    const index = reader.next();
    const line = reader.next();
    const pos = reader.pos();
    const robot: RobotState = { pos, dir: DIRS[reader.next()] ?? "east" };
    const gold = reader.next();
    const steps = reader.next();
    const flags = reader.next();
    const path = reader.positions();
    const discovered = reader.positions();
    const mined = flags & MINED ? reader.pos() : null;
    let print: string | null = null;
    if (flags & PRINTED) {
      print = summary.console[printed] ?? "";
      printed += 1;
    }
    let assigned: Assignment | null = null;
    if (flags & ASSIGNED) {
      const name = summary.names[reader.next()] ?? "";
      const kind = reader.next();
      const raw = reader.next();
      assigned = {
        name,
        value: kind === 0 ? { kind: "int", value: raw } : { kind: "bool", value: raw !== 0 },
      };
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
