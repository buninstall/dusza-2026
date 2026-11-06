import { createRandom, type Random } from "./prng.ts";

export type GeneratorOptions = {
  maxLines: number;
  maxDepth: number;
  variables: readonly string[];
};

export const DEFAULT_GENERATOR_OPTIONS: GeneratorOptions = {
  maxLines: 40,
  maxDepth: 3,
  variables: ["a", "b", "arany", "fal", "n"],
};

export type GeneratedCase = { seed: number; program: string; map: string };

export const MUTATIONS = [
  "tab",
  "doubleSpace",
  "trailingSpace",
  "keywordCase",
  "toplevelIndent",
  "deeperLine",
  "orphanElse",
  "numberRange",
  "reservedIdent",
  "emptyLine",
  "loneCr",
  "dropLastToken",
  "extraToken",
  "gluedOperator",
  "negativeLiteral",
  "accentIdent",
] as const;

export type Mutation = (typeof MUTATIONS)[number];

export type InvalidCase = GeneratedCase & { mutation: Mutation };

type Kind = "int" | "bool";
type Line = { indent: number; tokens: string[] };
type Context = {
  random: Random;
  options: GeneratorOptions;
  types: ReadonlyMap<string, Kind>;
  lines: Line[];
  target: number;
};

const ERROR_RATE = 0.015;
const INDENT_STEPS = [1, 2, 3, 4, 4, 8];
const HEADERS = new Set(["if", "while", "else"]);
const ARITHMETIC = ["+", "-", "*", "*"];
const COMPARISON = ["<", "<=", ">", ">="];
const EQUALITY = ["=", "<>"];
const LOGIC = ["and", "or"];
const ROBOTS = [">", "<", "^", "v"];
const KINDS: readonly Kind[] = ["int", "bool"];
const BOM = String.fromCharCode(0xfeff);

function chance(random: Random, probability: number): boolean {
  return random.next() < probability;
}

function other(kind: Kind): Kind {
  return kind === "int" ? "bool" : "int";
}

function variablesOf(ctx: Context, kind: Kind): string[] {
  return ctx.options.variables.filter((name) => ctx.types.get(name) === kind);
}

function literal(random: Random, kind: Kind, small: boolean): string {
  if (kind === "bool") return random.pick(["true", "false"]);
  return String(small ? random.int(0, 3) : random.int(0, 100));
}

function simple(ctx: Context, kind: Kind, small = false): string {
  const { random } = ctx;
  if (chance(random, ERROR_RATE)) {
    return chance(random, 0.5) ? "ghost" : literal(random, other(kind), small);
  }
  const names = variablesOf(ctx, kind);
  if (names.length > 0 && chance(random, 0.5)) return random.pick(names);
  return literal(random, kind, small);
}

function intExpression(ctx: Context): string[] {
  if (chance(ctx.random, 0.4)) return [simple(ctx, "int")];
  return [simple(ctx, "int"), ctx.random.pick(ARITHMETIC), simple(ctx, "int")];
}

function boolExpression(ctx: Context): string[] {
  const { random } = ctx;
  const roll = random.int(0, 5);
  if (roll === 0) return [simple(ctx, "bool")];
  if (roll === 1) return ["isThere", chance(random, 0.05) ? "3" : String(random.int(0, 2))];
  if (roll === 2) return ["not", simple(ctx, "bool")];
  if (roll === 3) return [simple(ctx, "int"), random.pick(COMPARISON), simple(ctx, "int")];
  if (roll === 4) {
    const kind = random.pick(KINDS);
    return [simple(ctx, kind), random.pick(EQUALITY), simple(ctx, kind)];
  }
  return [simple(ctx, "bool"), random.pick(LOGIC), simple(ctx, "bool")];
}

function expression(ctx: Context, kind: Kind): string[] {
  const wanted = chance(ctx.random, ERROR_RATE) ? other(kind) : kind;
  return wanted === "int" ? intExpression(ctx) : boolExpression(ctx);
}

function emit(ctx: Context, indent: number, tokens: string[]): void {
  ctx.lines.push({ indent, tokens });
}

function room(ctx: Context): boolean {
  return ctx.lines.length < ctx.target;
}

function setStatement(ctx: Context, indent: number, name?: string): void {
  const target = name ?? ctx.random.pick(ctx.options.variables);
  const kind = ctx.types.get(target) ?? "int";
  emit(ctx, indent, ["set", target, "to", ...expression(ctx, kind)]);
}

function block(ctx: Context, depth: number, parentIndent: number): number {
  const indent = parentIndent + ctx.random.pick(INDENT_STEPS);
  const count = chance(ctx.random, 0.1) ? 0 : ctx.random.int(1, 4);
  for (let index = 0; index < count && room(ctx); index += 1) statement(ctx, depth + 1, indent);
  return indent;
}

function ifStatement(ctx: Context, depth: number, indent: number): void {
  emit(ctx, indent, ["if", simple(ctx, "bool")]);
  block(ctx, depth, indent);
  if (room(ctx) && chance(ctx.random, 0.45)) {
    emit(ctx, indent, ["else"]);
    block(ctx, depth, indent);
  }
}

function whileStatement(ctx: Context, depth: number, indent: number): void {
  const names = variablesOf(ctx, "bool");
  const cond =
    names.length > 0 && chance(ctx.random, 0.8) ? ctx.random.pick(names) : simple(ctx, "bool");
  emit(ctx, indent, ["while", cond]);
  const bodyIndent = block(ctx, depth, indent);
  if (names.includes(cond) && chance(ctx.random, 0.8)) setStatement(ctx, bodyIndent, cond);
}

function simpleStatement(ctx: Context, roll: number): string[] {
  if (roll < 0.35) return ["step", "forward", simple(ctx, "int", true)];
  if (roll < 0.45) return ["turn", "by", simple(ctx, "int", true)];
  if (roll < 0.49) return ["mine", "here"];
  return ["print", simple(ctx, ctx.random.pick(KINDS))];
}

function statement(ctx: Context, depth: number, indent: number): void {
  const roll = ctx.random.next();
  const nested = depth < ctx.options.maxDepth;
  if (nested && roll < 0.12) ifStatement(ctx, depth, indent);
  else if (nested && roll < 0.2) whileStatement(ctx, depth, indent);
  else if (roll < 0.6) emit(ctx, indent, simpleStatement(ctx, roll));
  else setStatement(ctx, indent);
}

function assignTypes(random: Random, variables: readonly string[]): Map<string, Kind> {
  return new Map(variables.map((name, index) => [name, KINDS[index] ?? random.pick(KINDS)]));
}

function initialize(ctx: Context): void {
  for (const name of ctx.options.variables) {
    if (room(ctx) && chance(ctx.random, 0.95)) {
      emit(ctx, 0, ["set", name, "to", literal(ctx.random, ctx.types.get(name) ?? "int", false)]);
    }
  }
}

function programLines(random: Random, options: GeneratorOptions): Line[] {
  const ctx: Context = {
    random,
    options,
    types: assignTypes(random, options.variables),
    lines: [],
    target: chance(random, 0.02) ? 0 : random.int(1, options.maxLines),
  };
  if (chance(random, 0.9)) initialize(ctx);
  while (room(ctx)) statement(ctx, 0, 0);
  return ctx.lines;
}

function renderLine(line: Line): string {
  return `${" ".repeat(line.indent)}${line.tokens.join(" ")}`;
}

function finish(random: Random, rows: readonly string[]): string {
  const eol = chance(random, 0.1) ? "\r\n" : "\n";
  const bom = chance(random, 0.05) ? BOM : "";
  const trailing = rows.length > 0 && chance(random, 0.5) ? eol : "";
  return `${bom}${rows.join(eol)}${trailing}`;
}

export function generateMap(random: Random): string {
  const rows = random.int(1, 15);
  const cols = random.int(1, 15);
  const wallRate = random.next() * 0.35;
  const goldRate = random.next() * 0.3;
  const grid = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, (): string => {
      const roll = random.next();
      if (roll < wallRate) return "#";
      return roll < wallRate + goldRate ? "@" : ".";
    }),
  );
  const robotRow = grid[random.int(0, rows - 1)] ?? [];
  robotRow[random.int(0, cols - 1)] = random.pick(ROBOTS);
  return finish(random, [`${rows} ${cols}`, ...grid.map((row) => row.join(""))]);
}

export function generateProgram(
  seed: number,
  options: GeneratorOptions = DEFAULT_GENERATOR_OPTIONS,
): GeneratedCase {
  const random = createRandom(seed);
  const lines = programLines(random, options);
  const program = finish(random, lines.map(renderLine));
  return { seed, program, map: generateMap(random) };
}

type Site = { row: number; index: number };
type Mutator = (random: Random, lines: Line[]) => string[] | null;

const NUMBER = /^[0-9]+$/;
const GLUEABLE = new Set([...ARITHMETIC, ...COMPARISON, ...EQUALITY]);

function sites(lines: readonly Line[], accept: (token: string, index: number) => boolean): Site[] {
  return lines.flatMap((line, row) =>
    line.tokens.flatMap((token, index) => (accept(token, index) ? [{ row, index }] : [])),
  );
}

function rows(lines: readonly Line[], accept: (line: Line) => boolean): number[] {
  return lines.flatMap((line, row) => (accept(line) ? [row] : []));
}

function render(lines: readonly Line[]): string[] {
  return lines.map(renderLine);
}

function replaceToken(accept: (token: string, index: number) => boolean, next: string): Mutator {
  return (random, lines) => {
    const found = sites(lines, accept);
    if (found.length === 0) return null;
    const site = random.pick(found);
    return render(
      lines.map((line, row) =>
        row === site.row
          ? { ...line, tokens: line.tokens.map((t, i) => (i === site.index ? next : t)) }
          : line,
      ),
    );
  };
}

function insertAfterPlain(make: (line: Line) => Line): Mutator {
  return (random, lines) => {
    const plain = rows(lines, (line) => !HEADERS.has(line.tokens[0] ?? ""));
    if (plain.length === 0) return null;
    const row = random.pick(plain);
    const anchor = lines[row] as Line;
    return render([...lines.slice(0, row + 1), make(anchor), ...lines.slice(row + 1)]);
  };
}

function editLine(
  accept: (text: string) => boolean,
  edit: (text: string, random: Random) => string,
): Mutator {
  return (random, lines) => {
    const rendered = render(lines);
    const candidates = rendered.flatMap((text, row) => (accept(text) ? [row] : []));
    if (candidates.length === 0) return null;
    const row = random.pick(candidates);
    return rendered.map((text, index) => (index === row ? edit(text, random) : text));
  };
}

function insertAt(text: string, random: Random, inserted: string): string {
  const at = random.int(0, text.length);
  return `${text.slice(0, at)}${inserted}${text.slice(at)}`;
}

const any = () => true;

const MUTATORS: Record<Mutation, Mutator> = {
  tab: editLine(any, (text, random) => insertAt(text, random, "\t")),
  loneCr: editLine(
    any,
    (text, random) => insertAt(text.slice(0, -1), random, "\r") + text.slice(-1),
  ),
  doubleSpace: editLine(
    (text) => /\S \S/.test(text),
    (text) => text.replace(/(\S) (\S)/, "$1  $2"),
  ),
  trailingSpace: editLine(any, (text) => `${text} `),
  extraToken: editLine(any, (text) => `${text} 1`),
  keywordCase: replaceToken((_, index) => index === 0, "PRINT"),
  toplevelIndent: (_, lines) => render(lines).map((text, row) => (row === 0 ? `  ${text}` : text)),
  deeperLine: insertAfterPlain((line) => ({ indent: line.indent + 1, tokens: ["print", "1"] })),
  orphanElse: insertAfterPlain((line) => ({ indent: line.indent, tokens: ["else"] })),
  reservedIdent: insertAfterPlain((line) => ({
    indent: line.indent,
    tokens: ["set", "While", "to", "1"],
  })),
  numberRange: replaceToken((token) => NUMBER.test(token), "101"),
  negativeLiteral: replaceToken((token) => NUMBER.test(token), "-1"),
  accentIdent: replaceToken((_, index) => index > 0, "árany"),
  emptyLine: (random, lines) => {
    const rendered = render(lines);
    const at = random.int(0, rendered.length - 1);
    return [...rendered.slice(0, at), "", ...rendered.slice(at)];
  },
  dropLastToken: (random, lines) => {
    const row = random.int(0, lines.length - 1);
    return render(
      lines.map((line, index) =>
        index === row ? { ...line, tokens: line.tokens.slice(0, -1) } : line,
      ),
    );
  },
  gluedOperator: (random, lines) => {
    const found = sites(lines, (token, index) => index === 4 && GLUEABLE.has(token));
    if (found.length === 0) return null;
    const site = random.pick(found);
    return render(
      lines.map((line, row) =>
        row === site.row
          ? { ...line, tokens: [...line.tokens.slice(0, 3), line.tokens.slice(3, 6).join("")] }
          : line,
      ),
    );
  },
};

export function generateInvalidProgram(
  seed: number,
  options: GeneratorOptions = DEFAULT_GENERATOR_OPTIONS,
): InvalidCase {
  const random = createRandom(seed);
  const generated = programLines(random, options);
  const lines = generated.length > 0 ? generated : [{ indent: 0, tokens: ["print", "1"] }];
  const wanted = random.pick(MUTATIONS);
  const mutated = MUTATORS[wanted](random, lines);
  const mutation = mutated ? wanted : "extraToken";
  const program = mutated ?? MUTATORS.extraToken(random, lines) ?? [];
  return { seed, program: finish(random, program), map: generateMap(random), mutation };
}
