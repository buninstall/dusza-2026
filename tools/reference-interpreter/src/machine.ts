import type {
  Assignment,
  Cell,
  Dir,
  Event,
  Expr,
  MineMap,
  Outcome,
  Pos,
  RobotState,
  RunResult,
  RuntimeErrorCode,
  Simple,
  Stmt,
  StmtKind,
  Value,
} from "@minescript/engine";
import {
  evaluateBinary,
  evaluateNot,
  Fault,
  formatValue,
  readCondition,
  readCount,
  readSimple,
} from "./evaluate.ts";
import { parseMapText } from "./map.ts";
import { RUNTIME_MESSAGES } from "./messages.ts";
import { parse } from "./parser.ts";
import { MAX_MAP_SIZE, STEP_LIMIT } from "./source.ts";

class Halt {
  constructor(
    readonly code: RuntimeErrorCode,
    readonly line: number,
  ) {}
}

type Draft = {
  path: Pos[];
  discovered: Pos[];
  mined: Pos | null;
  print: string | null;
  assigned: Assignment | null;
};

type Machine = {
  cells: Cell[][];
  robot: RobotState;
  variables: Map<string, Value>;
  gold: number;
  steps: number;
  console: string[];
  discovered: Pos[];
  seen: Set<number>;
  events: Event[];
};

const DELTAS: Record<Dir, Pos> = {
  north: { row: -1, col: 0 },
  east: { row: 0, col: 1 },
  south: { row: 1, col: 0 },
  west: { row: 0, col: -1 },
};

const LEFT_OF: Record<Dir, Dir> = { east: "north", north: "west", west: "south", south: "east" };

const ISTHERE_CELLS: readonly Cell[] = ["empty", "wall", "gold"];

function copyRobot(robot: RobotState): RobotState {
  return { pos: { ...robot.pos }, dir: robot.dir };
}

function ahead(machine: Machine): Pos {
  const delta = DELTAS[machine.robot.dir];
  return { row: machine.robot.pos.row + delta.row, col: machine.robot.pos.col + delta.col };
}

function cellAt(machine: Machine, pos: Pos): Cell | null {
  return machine.cells[pos.row]?.[pos.col] ?? null;
}

function discover(machine: Machine, draft: Draft | null, pos: Pos): void {
  const key = pos.row * MAX_MAP_SIZE + pos.col;
  if (machine.seen.has(key)) return;
  machine.seen.add(key);
  machine.discovered.push({ ...pos });
  draft?.discovered.push({ ...pos });
}

function stepForward(machine: Machine, draft: Draft, count: Simple): void {
  const steps = readCount(count, machine.variables);
  for (let moved = 0; moved < steps; moved += 1) {
    const next = ahead(machine);
    const cell = cellAt(machine, next);
    if (cell === null || cell === "wall") throw new Fault("E_BEDROCK_HIT");
    machine.robot.pos = next;
    draft.path.push({ ...next });
    discover(machine, draft, next);
  }
}

function turnLeft(machine: Machine, quarters: Simple): void {
  const turns = readCount(quarters, machine.variables) % 4;
  for (let turn = 0; turn < turns; turn += 1) {
    machine.robot.dir = LEFT_OF[machine.robot.dir];
  }
}

function mineHere(machine: Machine, draft: Draft): void {
  const { row, col } = machine.robot.pos;
  const cells = machine.cells[row];
  if (cells?.[col] !== "gold") throw new Fault("E_NO_GOLD");
  cells[col] = "empty";
  machine.gold += 1;
  draft.mined = { row, col };
}

function isThere(machine: Machine, draft: Draft, arg: Simple): Value {
  const value = readSimple(arg, machine.variables);
  const wanted = value.kind === "int" ? ISTHERE_CELLS[value.value] : undefined;
  if (!wanted) throw new Fault("E_BAD_ARG");
  const target = ahead(machine);
  const cell = cellAt(machine, target);
  if (cell) discover(machine, draft, target);
  return { kind: "bool", value: (cell ?? "wall") === wanted };
}

function evaluate(machine: Machine, draft: Draft, expr: Expr): Value {
  if (expr.kind === "simple") return readSimple(expr.value, machine.variables);
  if (expr.kind === "isThere") return isThere(machine, draft, expr.arg);
  if (expr.kind === "not") return evaluateNot(expr.operand, machine.variables);
  return evaluateBinary(expr.op, expr.lhs, expr.rhs, machine.variables);
}

function assign(machine: Machine, draft: Draft, name: string, expr: Expr): void {
  const value = evaluate(machine, draft, expr);
  const previous = machine.variables.get(name);
  if (previous && previous.kind !== value.kind) throw new Fault("E_TYPE_MISMATCH");
  machine.variables.set(name, value);
  draft.assigned = { name, value };
}

function processLine<T>(machine: Machine, line: number, action: (draft: Draft) => T): T {
  if (machine.steps === STEP_LIMIT) throw new Halt("INSTRUCTION_COUNT_LIMIT_EXCEEDED", line);
  machine.steps += 1;
  const draft: Draft = { path: [], discovered: [], mined: null, print: null, assigned: null };
  try {
    return action(draft);
  } catch (error) {
    if (error instanceof Fault) throw new Halt(error.code, line);
    throw error;
  } finally {
    machine.events.push({
      index: machine.events.length,
      line,
      robot: copyRobot(machine.robot),
      ...draft,
      gold: machine.gold,
      steps: machine.steps,
    });
  }
}

function executeBlock(machine: Machine, body: readonly Stmt[]): void {
  for (const stmt of body) executeStmt(machine, stmt);
}

type IfKind = Extract<StmtKind, { kind: "if" }>;
type SimpleKind = Exclude<StmtKind, { kind: "if" } | { kind: "while" }>;

function executeIf(machine: Machine, line: number, kind: IfKind): void {
  const branch = processLine(machine, line, () => readCondition(kind.cond, machine.variables));
  if (branch) {
    executeBlock(machine, kind.thenBody);
  } else if (kind.elseBranch) {
    const elseBranch = kind.elseBranch;
    processLine(machine, elseBranch.line, () => undefined);
    executeBlock(machine, elseBranch.body);
  }
}

function executeSimple(machine: Machine, draft: Draft, kind: SimpleKind): void {
  if (kind.kind === "step") stepForward(machine, draft, kind.count);
  else if (kind.kind === "turn") turnLeft(machine, kind.quarters);
  else if (kind.kind === "mine") mineHere(machine, draft);
  else if (kind.kind === "set") assign(machine, draft, kind.name.name, kind.value);
  else {
    const text = formatValue(readSimple(kind.value, machine.variables));
    machine.console.push(text);
    draft.print = text;
  }
}

function executeStmt(machine: Machine, stmt: Stmt): void {
  const kind = stmt.kind;
  if (kind.kind === "while") {
    while (processLine(machine, stmt.line, () => readCondition(kind.cond, machine.variables))) {
      executeBlock(machine, kind.body);
    }
  } else if (kind.kind === "if") {
    executeIf(machine, stmt.line, kind);
  } else {
    processLine(machine, stmt.line, (draft) => executeSimple(machine, draft, kind));
  }
}

function createMachine(map: MineMap): Machine {
  const machine: Machine = {
    cells: map.cells.map((row) => [...row]),
    robot: { pos: { ...map.robot }, dir: map.dir },
    variables: new Map(),
    gold: 0,
    steps: 0,
    console: [],
    discovered: [],
    seen: new Set(),
    events: [],
  };
  discover(machine, null, map.robot);
  return machine;
}

function loadMap(mapText: string): MineMap {
  const checked = parseMapText(mapText);
  if (checked.map) return checked.map;
  const codes = checked.diagnostics.map((d) => `${d.code} (${d.span.line}. sor)`).join(", ");
  throw new Error(`A térkép hibás: ${codes}`);
}

export function run(src: string, mapText: string): RunResult {
  const map = loadMap(mapText);
  const parsed = parse(src);
  const machine = createMachine(map);
  if (!parsed.program) {
    return {
      outcome: { kind: "syntaxError", diagnostics: parsed.diagnostics },
      events: [],
      gold: 0,
      steps: 0,
      console: [],
      finalRobot: copyRobot(machine.robot),
      discovered: machine.discovered,
    };
  }
  let outcome: Outcome = { kind: "ok" };
  try {
    executeBlock(machine, parsed.program.body);
  } catch (error) {
    if (!(error instanceof Halt)) throw error;
    outcome = {
      kind: "runtimeError",
      code: error.code,
      line: error.line,
      message: RUNTIME_MESSAGES[error.code],
    };
  }
  return {
    outcome,
    events: machine.events,
    gold: machine.gold,
    steps: machine.steps,
    console: machine.console,
    finalRobot: copyRobot(machine.robot),
    discovered: machine.discovered,
  };
}
