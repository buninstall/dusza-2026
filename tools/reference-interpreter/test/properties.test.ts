import { beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import { join } from "node:path";
import {
  createEngine,
  type Engine,
  type MineMap,
  type RunResult,
  type RuntimeErrorCode,
} from "@minescript/engine";
import { generateProgram } from "../src/generate.ts";
import { parseMapText, run as referenceRun } from "../src/index.ts";

setDefaultTimeout(600_000);

const PROPERTY_SEEDS = Number(process.env.PROPERTY_SEEDS ?? "500");
const root = join(import.meta.dir, "..", "..", "..");
const seeds = Array.from({ length: PROPERTY_SEEDS }, (_, index) => index + 1);
const DIRS = new Set(["north", "east", "south", "west"]);
const CODES: ReadonlySet<RuntimeErrorCode> = new Set([
  "E_TYPE_MISMATCH",
  "E_UNINITIALIZED",
  "E_NON_BOOL_CONDITION",
  "E_BAD_OPERAND",
  "E_BEDROCK_HIT",
  "E_NO_GOLD",
  "E_BAD_ARG",
  "E_INT_OVERFLOW",
  "INSTRUCTION_COUNT_LIMIT_EXCEEDED",
]);

type Runner = { label: string; run: (src: string, map: string) => RunResult };

let engine: Engine;
const runners: Runner[] = [{ label: "referencia", run: referenceRun }];

beforeAll(async () => {
  const wasm = await Bun.file(
    join(root, "packages", "engine", "pkg", "minescript_wasm_bg.wasm"),
  ).arrayBuffer();
  engine = createEngine(wasm);
  runners.push({ label: "WASM", run: (src, map) => engine.run(src, map) });
});

function loadMap(text: string): MineMap {
  const parsed = parseMapText(text);
  if (!parsed.map) throw new Error("A generált térkép érvénytelen");
  return parsed.map;
}

function goldCount(map: MineMap): number {
  return map.cells.flat().filter((cell) => cell === "gold").length;
}

function inside(map: MineMap, row: number, col: number): boolean {
  return row >= 0 && row < map.rows && col >= 0 && col < map.cols;
}

function violations(map: MineMap, result: RunResult): string[] {
  const found: string[] = [];
  const fail = (message: string) => found.push(message);
  const { pos, dir } = result.finalRobot;
  if (result.steps > 1000) fail(`steps > 1000: ${result.steps}`);
  if (!inside(map, pos.row, pos.col)) fail(`a robot a térképen kívül áll: ${JSON.stringify(pos)}`);
  else if (map.cells[pos.row]?.[pos.col] === "wall") fail("a robot falon áll");
  if (!DIRS.has(dir)) fail(`érvénytelen irány: ${dir}`);
  if (result.gold > goldCount(map)) fail(`több arany, mint a térképen: ${result.gold}`);
  const mined = result.events.filter((event) => event.mined !== null).length;
  if (mined !== result.gold) fail(`a gold (${result.gold}) nem egyezik a mined események számával`);
  const minedKeys = result.events.flatMap((event) =>
    event.mined ? [`${event.mined.row},${event.mined.col}`] : [],
  );
  if (new Set(minedKeys).size !== minedKeys.length) fail("ugyanaz a mező kétszer bányászva");
  if (result.events.length !== result.steps) fail("az események száma nem egyezik a lépésszámmal");
  result.events.forEach((event, index) => {
    if (event.index !== index || event.steps !== index + 1) fail(`hibás számozás: ${index}`);
  });
  const printed = result.events.flatMap((event) => (event.print === null ? [] : [event.print]));
  if (!Bun.deepEquals(printed, result.console)) fail("a konzol nem egyezik a print eseményekkel");
  const start = result.discovered[0];
  if (!start || start.row !== map.robot.row || start.col !== map.robot.col) {
    fail("a felfedezett mezők első eleme nem a kezdőmező");
  }
  const keys = result.discovered.map((cell) => `${cell.row},${cell.col}`);
  if (new Set(keys).size !== keys.length) fail("ismétlődő felfedezett mező");
  if (result.discovered.some((cell) => !inside(map, cell.row, cell.col))) {
    fail("pályán kívüli felfedezett mező");
  }
  const outcome = result.outcome;
  if (outcome.kind === "syntaxError") fail("a generált helyes program szintaktikai hibát kapott");
  if (outcome.kind === "runtimeError") {
    if (!CODES.has(outcome.code)) fail(`ismeretlen hibakód: ${outcome.code}`);
    if (outcome.code === "INSTRUCTION_COUNT_LIMIT_EXCEEDED") {
      if (result.steps !== 1000) fail(`limitnél a lépésszám ${result.steps}, nem 1000`);
    } else if (result.events.at(-1)?.line !== outcome.line) {
      fail("a hiba után még futott sor, vagy a hibasor nem az utolsó esemény");
    }
  }
  return found;
}

const sameRun = (a: RunResult, b: RunResult) =>
  Bun.deepEquals(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)));

describe("invariánsok minden generált futásra", () => {
  for (const label of ["referencia", "WASM"]) {
    test(`${label}: ${PROPERTY_SEEDS} seed, minden invariáns teljesül`, () => {
      const runner = runners.find((candidate) => candidate.label === label);
      if (!runner) throw new Error(`hiányzó futtató: ${label}`);
      const reports = seeds.flatMap((seed) => {
        const generated = generateProgram(seed);
        const found = violations(
          loadMap(generated.map),
          runner.run(generated.program, generated.map),
        );
        return found.length === 0 ? [] : [`seed ${seed}: ${found.join("; ")}`];
      });
      expect(reports).toEqual([]);
    });
  }
});

describe("metamorf tulajdonságok", () => {
  const openMap = "3 3\n...\n.>.\n...\n";
  const corridor = "1 15\n>..............\n";

  test("turn by n ugyanoda fordít, mint turn by (n mod 4), 0..100", () => {
    for (const runner of runners) {
      for (let n = 0; n <= 100; n += 1) {
        const full = runner.run(`turn by ${n}\n`, openMap).finalRobot.dir;
        const reduced = runner.run(`turn by ${n % 4}\n`, openMap).finalRobot.dir;
        expect(`${runner.label} n=${n}: ${full}`).toBe(`${runner.label} n=${n}: ${reduced}`);
      }
    }
  });

  test("négy egymás utáni turn by 1 visszaállítja az irányt, minden kezdőirányból", () => {
    for (const runner of runners) {
      for (const symbol of [">", "<", "^", "v"]) {
        const map = `3 3\n...\n.${symbol}.\n...\n`;
        const before = runner.run("", map).finalRobot.dir;
        const after = runner.run("turn by 1\nturn by 1\nturn by 1\nturn by 1\n", map).finalRobot;
        expect(`${runner.label} ${symbol}: ${after.dir}`).toBe(
          `${runner.label} ${symbol}: ${before}`,
        );
      }
    }
  });

  test("step forward a, majd step forward b ugyanoda visz és ugyanazt fedi fel, mint step forward a+b", () => {
    for (const runner of runners) {
      for (let a = 0; a <= 14; a += 1) {
        for (let b = 0; a + b <= 14; b += 1) {
          const split = runner.run(`step forward ${a}\nstep forward ${b}\n`, corridor);
          const joined = runner.run(`step forward ${a + b}\n`, corridor);
          expect(split.outcome.kind).toBe("ok");
          expect(split.finalRobot).toEqual(joined.finalRobot);
          expect(split.discovered).toEqual(joined.discovered);
        }
      }
    }
  });

  test("egy lépéssel a fal elé jutva a további lépés E_BEDROCK_HIT, a robot az utolsó érvényes mezőn marad", () => {
    for (const runner of runners) {
      const result = runner.run("step forward 15\n", corridor);
      expect(result.outcome).toMatchObject({
        kind: "runtimeError",
        code: "E_BEDROCK_HIT",
        line: 1,
      });
      expect(result.finalRobot.pos).toEqual({ row: 0, col: 14 });
    }
  });

  test("ugyanaz a bemenet kétszer futtatva azonos eredményt ad (alaphelyzet minden futásnál)", () => {
    for (const runner of runners) {
      for (const seed of seeds.slice(0, 200)) {
        const generated = generateProgram(seed);
        const first = runner.run(generated.program, generated.map);
        const second = runner.run(generated.program, generated.map);
        expect(sameRun(first, second)).toBe(true);
      }
    }
  });

  test("a formázott program futása megegyezik az eredetiével (D22)", () => {
    for (const seed of seeds.slice(0, 200)) {
      const generated = generateProgram(seed);
      const formatted = engine.format(generated.program).text;
      const original = engine.run(generated.program, generated.map);
      const reformatted = engine.run(formatted, generated.map);
      const { events: _a, ...originalRest } = original;
      const { events: _b, ...reformattedRest } = reformatted;
      expect(`seed ${seed}: ${JSON.stringify(reformattedRest.outcome)}`).toBe(
        `seed ${seed}: ${JSON.stringify(originalRest.outcome)}`,
      );
      expect(reformattedRest.console).toEqual(originalRest.console);
      expect(reformattedRest.gold).toBe(originalRest.gold);
      expect(reformattedRest.steps).toBe(originalRest.steps);
      expect(reformattedRest.finalRobot).toEqual(originalRest.finalRobot);
    }
  });

  test("térkép: parse → serialize → parse identitás, és a referencia is ugyanazt olvassa vissza", () => {
    for (const seed of seeds) {
      const text = generateProgram(seed).map;
      const parsed = engine.parseMap(text).map;
      if (!parsed) throw new Error(`seed ${seed}: érvénytelen generált térkép`);
      const serialized = engine.serializeMap(parsed);
      expect(engine.parseMap(serialized).map).toEqual(parsed);
      expect(parseMapText(serialized).map).toEqual(parsed);
    }
  });
});
