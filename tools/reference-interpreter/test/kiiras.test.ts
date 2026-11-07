import { beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import { join } from "node:path";
import { createEngine, type Diagnostic, type Engine, type RunResult } from "@minescript/engine";
import { check, parseMapText, run as referenceRun } from "../src/index.ts";

setDefaultTimeout(120_000);

const root = join(import.meta.dir, "..", "..", "..");
let engine: Engine;

beforeAll(async () => {
  const wasm = await Bun.file(
    join(root, "packages", "engine", "pkg", "minescript_wasm_bg.wasm"),
  ).arrayBuffer();
  engine = createEngine(wasm);
});

const DOT = "1 1\n>\n";
const OPEN = "3 3\n...\n.>.\n...\n";
const EXAMPLE_MAP = "3 15\n....@..........\n.#############.\n.......@...>...\n";
const WALK = [
  "set count to 0",
  "set fal to isThere 1",
  "set megy to not fal",
  "while megy",
  "  set arany to isThere 2",
  "  if arany",
  "    step forward 1",
  "    mine here",
  "    set count to count + 1",
  "  else",
  "    step forward 1",
  "  set fal to isThere 1",
  "  set megy to not fal",
  "print count",
].join("\n");

type Expectation = {
  kind?: "ok" | "runtimeError";
  code?: string;
  line?: number;
  steps?: number;
  console?: string[];
  gold?: number;
  robot?: { row: number; col: number; dir?: string };
  discovered?: [number, number][];
};

type RunCase = [ref: string, name: string, program: string, map: string, want: Expectation];

function runners(): [string, (src: string, map: string) => RunResult][] {
  return [
    ["WASM-motor", (src, map) => engine.run(src, map)],
    ["referencia", referenceRun],
  ];
}

function verify(result: RunResult, want: Expectation): string[] {
  const problems: string[] = [];
  const outcome = result.outcome;
  if (want.kind && outcome.kind !== want.kind)
    problems.push(`kimenet: ${outcome.kind}, elvárt: ${want.kind}`);
  if (want.code !== undefined) {
    const code = outcome.kind === "runtimeError" ? outcome.code : outcome.kind;
    if (code !== want.code) problems.push(`hibakód: ${code}, elvárt: ${want.code}`);
  }
  if (want.line !== undefined) {
    const line = outcome.kind === "runtimeError" ? outcome.line : null;
    if (line !== want.line) problems.push(`hibasor: ${line}, elvárt: ${want.line}`);
  }
  if (want.steps !== undefined && result.steps !== want.steps)
    problems.push(`lépésszám: ${result.steps}, elvárt: ${want.steps}`);
  if (want.gold !== undefined && result.gold !== want.gold)
    problems.push(`arany: ${result.gold}, elvárt: ${want.gold}`);
  if (want.console && !Bun.deepEquals(result.console, want.console)) {
    problems.push(
      `konzol: ${JSON.stringify(result.console.slice(0, 12))}, elvárt: ${JSON.stringify(want.console.slice(0, 12))}`,
    );
  }
  if (want.robot) {
    const { pos, dir } = result.finalRobot;
    if (
      pos.row !== want.robot.row ||
      pos.col !== want.robot.col ||
      (want.robot.dir && dir !== want.robot.dir)
    ) {
      problems.push(
        `robot: (${pos.row},${pos.col}) ${dir}, elvárt: (${want.robot.row},${want.robot.col}) ${want.robot.dir ?? ""}`,
      );
    }
  }
  if (want.discovered) {
    const got = result.discovered.map((cell) => `${cell.row},${cell.col}`).sort();
    const expected = want.discovered.map(([row, col]) => `${row},${col}`).sort();
    if (!Bun.deepEquals(got, expected))
      problems.push(`felfedezett: ${got.join(" ")}, elvárt: ${expected.join(" ")}`);
  }
  return problems;
}

function runCases(title: string, cases: RunCase[]) {
  describe(title, () => {
    for (const [ref, name, program, map, want] of cases) {
      test(`[${ref}] ${name}`, () => {
        for (const [label, execute] of runners()) {
          const problems = verify(execute(program, map), want);
          expect(`${label}: ${problems.join("; ") || "rendben"}`).toBe(`${label}: rendben`);
        }
      });
    }
  });
}

function errorLines(diagnostics: readonly Diagnostic[]): number[] {
  return [
    ...new Set(diagnostics.filter((d) => d.severity === "error").map((d) => d.span.line)),
  ].sort((a, b) => a - b);
}

type SyntaxCase = [ref: string, name: string, program: string, badLines: number[]];

function syntaxCases(title: string, cases: SyntaxCase[]) {
  describe(title, () => {
    for (const [ref, name, program, badLines] of cases) {
      test(`[${ref}] ${name}`, () => {
        const fromEngine = errorLines(engine.analyze(program).diagnostics);
        const fromReference = [...new Set(check(program).diagnostics.map((d) => d.line))].sort(
          (a, b) => a - b,
        );
        if (badLines.length === 0) {
          expect(`WASM-motor: ${fromEngine.join(",") || "helyes"}`).toBe("WASM-motor: helyes");
          expect(`referencia: ${fromReference.join(",") || "helyes"}`).toBe("referencia: helyes");
          return;
        }
        for (const line of badLines) {
          expect(`WASM-motor jelöli a(z) ${line}. sort: ${fromEngine.includes(line)}`).toBe(
            `WASM-motor jelöli a(z) ${line}. sort: true`,
          );
          expect(`referencia jelöli a(z) ${line}. sort: ${fromReference.includes(line)}`).toBe(
            `referencia jelöli a(z) ${line}. sort: true`,
          );
        }
        const result = engine.run(program, DOT);
        expect(`a hibás program nem fut: ${result.outcome.kind} ${result.steps} lépés`).toBe(
          "a hibás program nem fut: syntaxError 0 lépés",
        );
      });
    }
  });
}

describe("1. A térkép formátuma", () => {
  const parse = (text: string) => ({
    engine: engine.parseMap(text),
    reference: parseMapText(text),
  });

  test("[1] a kiírás példatérképe betölthető: 3 sor, 15 oszlop, a robot a 3. sor 12. oszlopában kelet felé néz, 2 aranyrög", () => {
    for (const [label, result] of Object.entries(parse(EXAMPLE_MAP))) {
      const map = result.map;
      expect(
        `${label}: ${map ? `${map.rows}×${map.cols} (${map.robot.row},${map.robot.col}) ${map.dir}` : "érvénytelen"}`,
      ).toBe(`${label}: 3×15 (2,11) east`);
      expect(`${label} arany: ${map?.cells.flat().filter((cell) => cell === "gold").length}`).toBe(
        `${label} arany: 2`,
      );
    }
  });

  const VALID: [string, string][] = [
    ["1×1-es térkép (minimum)", "1 1\n>\n"],
    ["15×15-ös térkép (maximum)", `15 15\n>${".".repeat(14)}\n${`${".".repeat(15)}\n`.repeat(14)}`],
    ["1×15-ös térkép", `1 15\n>${".".repeat(14)}\n`],
    ["15×1-es térkép", `15 1\n>\n${".\n".repeat(14)}`],
    ["minden mezőtípus: üres, arany, fal, robot", "2 3\n.@#\n>..\n"],
  ];
  for (const [name, text] of VALID) {
    test(`[1] érvényes: ${name}`, () => {
      for (const [label, result] of Object.entries(parse(text)))
        expect(`${label}: ${result.map !== null}`).toBe(`${label}: true`);
    });
  }

  for (const [symbol, dir] of [
    [">", "east"],
    ["<", "west"],
    ["^", "north"],
    ["v", "south"],
  ] as const) {
    test(`[1] a(z) ${symbol} robot ${dir === "east" ? "kelet" : dir === "west" ? "nyugat" : dir === "north" ? "észak" : "dél"} felé néz`, () => {
      for (const [label, result] of Object.entries(parse(`1 2\n${symbol}.\n`)))
        expect(`${label}: ${result.map?.dir}`).toBe(`${label}: ${dir}`);
    });
  }

  const INVALID: [string, string][] = [
    ["0 sor", "0 1\n"],
    ["0 oszlop", "1 0\n\n"],
    ["16 sor", `16 1\n>\n${".\n".repeat(15)}`],
    ["16 oszlop", `1 16\n>${".".repeat(15)}\n`],
    ["nincs robot", "1 2\n..\n"],
    ["két robot", "1 2\n><\n"],
    ["négy robot", "2 2\n><\n^v\n"],
    ["kevesebb sor, mint a fejlécben", "2 2\n>.\n"],
    ["több sor, mint a fejlécben", "1 2\n>.\n..\n"],
    ["rövid sor", "2 3\n>..\n..\n"],
    ["hosszú sor", "1 2\n>..\n"],
    ["ismeretlen karakter", "1 2\n>x\n"],
    ["a két dimenzió két szóközzel elválasztva", "1  2\n>.\n"],
    ["hiányzó második dimenzió", "1\n>\n"],
    ["nem számjegyes dimenzió", "a b\n>.\n"],
    ["üres fájl", ""],
  ];
  for (const [name, text] of INVALID) {
    test(`[1] hibás formátum, nem tölthető be, érthető magyar hibaüzenettel: ${name}`, () => {
      const results = parse(text);
      for (const [label, result] of Object.entries(results)) {
        expect(`${label}: ${result.map === null}`).toBe(`${label}: true`);
        const messages = result.diagnostics
          .filter((d) => d.severity === "error")
          .map((d) => d.message);
        expect(
          `${label} hibaüzenet: ${messages.length > 0 && messages.every((m) => m.trim().length > 5)}`,
        ).toBe(`${label} hibaüzenet: true`);
      }
    });
  }

  test("[1] a térkép exportja visszatöltve ugyanazt a térképet adja", () => {
    const map = engine.parseMap(EXAMPLE_MAP).map;
    if (!map) throw new Error("A példatérkép nem tölthető be.");
    expect(engine.serializeMap(map)).toBe(EXAMPLE_MAP);
  });
});

runCases("1. A programfájl és a példaprogram", [
  [
    "1",
    "a kiírás példaprogramja a példatérképen: a robot előtt üres kamra van, ezért false-t ír ki",
    "set arany to isThere 2\nprint arany",
    EXAMPLE_MAP,
    { kind: "ok", steps: 2, console: ["false"] },
  ],
  [
    "1",
    "a program lehet üres is: hiba nélkül lefut, 0 lépés",
    "",
    DOT,
    { kind: "ok", steps: 0, console: [] },
  ],
  [
    "1",
    "isThere 0 üres kamrára igaz",
    "set a to isThere 0\nprint a",
    "1 2\n>.\n",
    { console: ["true"] },
  ],
  ["1", "isThere 1 falra igaz", "set a to isThere 1\nprint a", "1 2\n>#\n", { console: ["true"] }],
  [
    "1",
    "isThere 2 aranyrögre igaz",
    "set a to isThere 2\nprint a",
    "1 2\n>@\n",
    { console: ["true"] },
  ],
  [
    "1",
    "isThere 2 üres kamrára hamis",
    "set a to isThere 2\nprint a",
    "1 2\n>.\n",
    { console: ["false"] },
  ],
]);

runCases("2. A kiírás sétáló programja", [
  [
    "2",
    "a példatérképen: 3 kör után a térkép szélénél megáll, 0 aranyat ír ki, 3 + 3×7 + 2 = 26 lépés",
    WALK,
    EXAMPLE_MAP,
    { kind: "ok", steps: 26, console: ["0"], gold: 0, robot: { row: 2, col: 14, dir: "east" } },
  ],
  [
    "2",
    "a >.@.@# folyosón: mindkét aranyat kibányássza, 35 lépés, 2-t ír ki",
    WALK,
    "1 6\n>.@.@#\n",
    { kind: "ok", steps: 35, console: ["2"], gold: 2, robot: { row: 0, col: 4, dir: "east" } },
  ],
]);

syntaxCases("2. Az EBNF nyelvtan: helyes szerkezetek", [
  ["2", "step forward simpleval", "step forward 1", []],
  ["2", "turn by simpleval", "turn by 1", []],
  ["2", "mine here", "mine here", []],
  ["2", "print simpleval", "print 1", []],
  ["2", "set ident to simpleval", "set a to 1", []],
  ["2", "set ident to isThere simpleval", "set a to isThere 0", []],
  ["2", "set ident to not simpleval", "set a to not true", []],
  ...["+", "-", "*", "=", "<>", "<", "<=", ">", ">="].map(
    (op): SyntaxCase => ["2", `binop: ${op}`, `set a to 1 ${op} 2`, []],
  ),
  ["2", "binop: and", "set a to true and false", []],
  ["2", "binop: or", "set a to true or false", []],
  ["2", "simpleval: azonosító", "set a to 1\nprint a", []],
  ["2", "simpleval: true és false", "print true\nprint false", []],
  ["2", "if blokkal", "if true\n  print 1", []],
  ["2", "if–else", "if true\n  print 1\nelse\n  print 2", []],
  ["2", "while blokkal", "while false\n  print 1", []],
  ["2", "egymásba ágyazott blokkok", "if true\n  while false\n    print 1\n  print 2", []],
  ["2", "azonosító: betű, utána betűk és számjegyek", "set a1b2 to 1", []],
  ["2", "a 0 és a 100 is érvényes szám", "print 0\nprint 100", []],
]);

const KEYWORDS = [
  "and",
  "by",
  "else",
  "false",
  "forward",
  "here",
  "if",
  "isThere",
  "mine",
  "not",
  "or",
  "print",
  "set",
  "step",
  "to",
  "true",
  "turn",
  "while",
];
const casings = (word: string) => [
  ...new Set([
    word.toLowerCase(),
    word.toUpperCase(),
    `${word[0]?.toUpperCase()}${word.slice(1).toLowerCase()}`,
  ]),
];

syntaxCases("2. Az EBNF nyelvtan: hibás szerkezetek", [
  ["2", "step forward nélkül", "step 1", [1]],
  ["2", "turn by nélkül", "turn 1", [1]],
  ["2", "mine here nélkül", "mine", [1]],
  ["2", "print paraméter nélkül", "print", [1]],
  ["2", "set to nélkül", "set a 1", [1]],
  ["2", "set célja szám", "set 1 to 2", [1]],
  ["2", "set célja nem azonosító", "set true to 2", [1]],
  ["2", "beágyazott kifejezés", "set a to 1 + 2 + 3", [1]],
  ["2", "kifejezés a print paraméterében", "print 1 + 2", [1]],
  ["2", "isThere a step paraméterében", "step forward isThere 1", [1]],
  ["2", "isThere az if feltételében", "if isThere 1\n  print 1", [1]],
  ["2", "not a while feltételében", "while not true\n  print 1", [1]],
  ["2", "hiányzó jobb operandus", "set a to 1 +", [1]],
  ["2", "hiányzó not operandus", "set a to not", [1]],
  ["2", "ismeretlen operátor", "set a to 1 % 2", [1]],
  ["2", "fölösleges token", "mine here now", [1]],
  ["2", "számmal kezdődő azonosító", "set 1a to 1", [1]],
  ["2", "aláhúzás az azonosítóban", "set a_b to 1", [1]],
  ["2", "ékezetes azonosító", "set árany to 1", [1]],
  ["2", "101 nem érvényes szám", "print 101", [1]],
  ["2", "negatív szám nem érvényes literál", "print -1", [1]],
  ["2", "tizedes szám nem érvényes", "print 1.5", [1]],
  ["2", "a kulcsszó nagybetűvel nem kulcsszó: Set", "Set a to 1", [1]],
  ["2", "isthere kisbetűvel nem az isThere függvény", "set a to isthere 1", [1]],
  ["2", "TRUE nem logikai literál", "print TRUE", [1]],
  ...KEYWORDS.flatMap((keyword) =>
    casings(keyword).map(
      (form): SyntaxCase => ["2", `kulcsszó nem lehet azonosító: ${form}`, `set ${form} to 1`, [1]],
    ),
  ),
]);

syntaxCases("2.1 Soronkénti feldolgozás és tokenizálás", [
  ["2.1", "két szóköz a tokenek között", "print  1", [1]],
  ["2.1", "tab a behúzásban", "if true\n\tprint 1", [2]],
  ["2.1", "tab a tokenek között", "print\t1", [1]],
  ["2.1", "üres sor a program közepén", "print 1\n\nprint 2", [2]],
  ["2.1", "csak szóközökből álló sor", "print 1\n   \nprint 2", [2]],
  ["2.1", "blokkon belül nem egységes behúzás", "if true\n  print 1\n   print 2", [3]],
  ["2.1", "behúzott sor blokknyitó nélkül", "print 1\n  print 2", [2]],
  ["2.1", "a legfelső szint behúzva", "  print 1", [1]],
  ["2.1", "else rossz behúzáson", "if true\n  print 1\n  else\n  print 2", [3]],
  ["2.1", "else if nélkül", "else\n  print 1", [1]],
  ["2.1", "ismeretlen utasítás", "jump 1", [1]],
  ["2.1", "több hibás sor, mindegyik jelölve", "jump 1\nprint 1\nfly 2", [1, 3]],
  [
    "2.1",
    "különböző blokkokban eltérő behúzás megengedett",
    "if true\n  print 1\nif true\n    print 2",
    [],
  ],
  ["2.1", "az else az if törzsével azonos szinten", "if false\n print 1\nelse\n print 2", []],
  ["2.1", "a behúzás csökkenése lezárja a törzset", "if false\n  print 1\nprint 2", []],
]);

runCases("2.1 A hibás program nem fut", [
  [
    "2.1",
    "szintaktikai hibánál nincs futás, nincs kimenet, a lépésszám 0",
    "print 1\nprint  2",
    DOT,
    { steps: 0, console: [] },
  ],
]);

runCases("2.2.1 Kulcsszavak működése", [
  ["2.2.1", "összeadás egészekre", "set a to 2 + 3\nprint a", DOT, { console: ["5"] }],
  [
    "2.2.1",
    "kivonás, negatív eredmény is lehet",
    "set a to 0 - 5\nprint a",
    DOT,
    { console: ["-5"] },
  ],
  ["2.2.1", "szorzás", "set a to 6 * 7\nprint a", DOT, { console: ["42"] }],
  [
    "2.2.1",
    "aritmetika logikai bal operandussal: E_BAD_OPERAND",
    "set a to true + 1",
    DOT,
    { code: "E_BAD_OPERAND", line: 1 },
  ],
  [
    "2.2.1",
    "aritmetika logikai jobb operandussal: E_BAD_OPERAND",
    "set a to 1 * false",
    DOT,
    { code: "E_BAD_OPERAND", line: 1 },
  ],
  ["2.2.1", "kisebb", "set a to 1 < 2\nprint a", DOT, { console: ["true"] }],
  ["2.2.1", "kisebb-egyenlő határon", "set a to 2 <= 2\nprint a", DOT, { console: ["true"] }],
  ["2.2.1", "nagyobb", "set a to 1 > 2\nprint a", DOT, { console: ["false"] }],
  ["2.2.1", "nagyobb-egyenlő", "set a to 3 >= 2\nprint a", DOT, { console: ["true"] }],
  [
    "2.2.1",
    "összehasonlítás logikai operandussal: E_BAD_OPERAND",
    "set a to true < 1",
    DOT,
    { code: "E_BAD_OPERAND", line: 1 },
  ],
  ["2.2.1", "egyenlőség egészekre", "set a to 4 = 4\nprint a", DOT, { console: ["true"] }],
  [
    "2.2.1",
    "egyenlőség logikaiakra",
    "set a to true = false\nprint a",
    DOT,
    { console: ["false"] },
  ],
  [
    "2.2.1",
    "különbözőség logikaiakra",
    "set a to true <> false\nprint a",
    DOT,
    { console: ["true"] },
  ],
  [
    "2.2.1",
    "egyenlőség eltérő típusokkal: E_BAD_OPERAND",
    "set a to 1 = true",
    DOT,
    { code: "E_BAD_OPERAND", line: 1 },
  ],
  [
    "2.2.1",
    "különbözőség eltérő típusokkal: E_BAD_OPERAND",
    "set a to false <> 0",
    DOT,
    { code: "E_BAD_OPERAND", line: 1 },
  ],
  [
    "2.2.1",
    "az = első operandusa bármilyen típusú, a típusegyezést a második beolvasása után ellenőrzi",
    "set a to true = c",
    DOT,
    { code: "E_UNINITIALIZED", line: 1 },
  ],
  ["2.2.1", "and", "set a to true and false\nprint a", DOT, { console: ["false"] }],
  ["2.2.1", "or", "set a to false or true\nprint a", DOT, { console: ["true"] }],
  ["2.2.1", "not", "set a to not false\nprint a", DOT, { console: ["true"] }],
  [
    "2.2.1",
    "and egésszel: E_BAD_OPERAND",
    "set a to 1 and true",
    DOT,
    { code: "E_BAD_OPERAND", line: 1 },
  ],
  [
    "2.2.1",
    "or egész jobb operandussal: E_BAD_OPERAND",
    "set a to true or 5",
    DOT,
    { code: "E_BAD_OPERAND", line: 1 },
  ],
  [
    "2.2.1",
    "not egésszel: E_BAD_OPERAND",
    "set a to not 1",
    DOT,
    { code: "E_BAD_OPERAND", line: 1 },
  ],
  [
    "2.2.1",
    "true or c: a második operandust akkor is beolvassa (E_UNINITIALIZED)",
    "set a to true or c",
    DOT,
    { code: "E_UNINITIALIZED", line: 1 },
  ],
  [
    "2.2.1",
    "false and c: a második operandust akkor is beolvassa (E_UNINITIALIZED)",
    "set a to false and c",
    DOT,
    { code: "E_UNINITIALIZED", line: 1 },
  ],
  [
    "2.2.1",
    "balról jobbra: a hibás első operandus előbb bukik, mint a nem létező második",
    "set a to true + c",
    DOT,
    { code: "E_BAD_OPERAND", line: 1 },
  ],
  [
    "2.2.1",
    "balról jobbra: a nem létező első operandus előbb bukik",
    "set a to c + true",
    DOT,
    { code: "E_UNINITIALIZED", line: 1 },
  ],
  [
    "2.2.1",
    "a set előbb kiértékel, hiba esetén nem ír: a futás a hibánál megáll",
    "set a to 1\nset a to c\nprint a",
    DOT,
    { code: "E_UNINITIALIZED", line: 2, console: [] },
  ],
  [
    "2.2.1",
    "az első értékadás létrehozza, a következő felülírja",
    "set a to 1\nset a to 2\nprint a",
    DOT,
    { console: ["2"] },
  ],
  [
    "2.2.1",
    "if: igaz feltételnél a then-ág fut",
    "if true\n  print 1\nelse\n  print 2",
    DOT,
    { console: ["1"] },
  ],
  [
    "2.2.1",
    "if: hamis feltételnél az else-ág fut",
    "if false\n  print 1\nelse\n  print 2",
    DOT,
    { console: ["2"] },
  ],
  [
    "2.2.1",
    "if else nélkül, hamis feltétel: semmi nem fut",
    "if false\n  print 1",
    DOT,
    { console: [] },
  ],
  [
    "2.2.1",
    "while: a törzs addig ismétlődik, amíg a feltétel igaz",
    "set i to 0\nset c to i < 3\nwhile c\n  set i to i + 1\n  print i\n  set c to i < 3",
    DOT,
    { console: ["1", "2", "3"] },
  ],
]);

runCases("2.2.2 A nyelv alapszabályai", [
  [
    "2.2.2",
    "nincs implicit konverzió: egész if-feltétel",
    "if 1\n  print 1",
    DOT,
    { code: "E_NON_BOOL_CONDITION", line: 1 },
  ],
  [
    "2.2.2",
    "nincs implicit konverzió: egész while-feltétel",
    "while 0\n  print 1",
    DOT,
    { code: "E_NON_BOOL_CONDITION", line: 1 },
  ],
  [
    "2.2.2",
    "a változó az első set-kor jön létre: előtte olvasva E_UNINITIALIZED",
    "print a\nset a to 1",
    DOT,
    { code: "E_UNINITIALIZED", line: 1 },
  ],
  [
    "2.2.2",
    "a blokkban létrehozott változó a program végéig él",
    "if true\n  set a to 5\nprint a",
    DOT,
    { console: ["5"] },
  ],
  [
    "2.2.2",
    "típusrögzítés: egész után logikai E_TYPE_MISMATCH",
    "set a to 1\nset a to true",
    DOT,
    { code: "E_TYPE_MISMATCH", line: 2 },
  ],
  [
    "2.2.2",
    "típusrögzítés: logikai után egész E_TYPE_MISMATCH",
    "set a to true\nset a to 3",
    DOT,
    { code: "E_TYPE_MISMATCH", line: 2 },
  ],
  [
    "2.2.2",
    "a típusellenőrzés futásidejű: a le nem futó hibás sor nem okoz hibát",
    "if false\n  set a to true + 1\nprint 7",
    DOT,
    { kind: "ok", console: ["7"] },
  ],
  [
    "2.2.2",
    "kis- és nagybetűérzékeny azonosítók: arany és Arany külön változó",
    "set arany to 1\nset Arany to true\nprint arany\nprint Arany",
    DOT,
    { console: ["1", "true"] },
  ],
  [
    "2.2.2",
    "a sorok fentről lefelé, sorban futnak",
    "print 1\nprint 2\nprint 3",
    DOT,
    { console: ["1", "2", "3"] },
  ],
]);

runCases("2.2.3 Robot API", [
  [
    "2.2.3",
    "step forward n: n mezőt lép, a köztes mezőket is érinti",
    "step forward 3",
    "1 5\n>....\n",
    {
      robot: { row: 0, col: 3 },
      discovered: [
        [0, 0],
        [0, 1],
        [0, 2],
        [0, 3],
      ],
    },
  ],
  [
    "2.2.3",
    "step forward: az áthaladáskor érintett aranyrögöt ott hagyja, utána kibányászható",
    "step forward 3\nturn by 2\nstep forward 1\nmine here",
    "1 5\n>.@..\n",
    { kind: "ok", gold: 1, robot: { row: 0, col: 2 } },
  ],
  [
    "2.2.3",
    "step forward 0: nem mozdul",
    "step forward 0",
    OPEN,
    { kind: "ok", robot: { row: 1, col: 1 } },
  ],
  [
    "2.2.3",
    "step forward változó paraméterrel",
    "set n to 2\nstep forward n",
    "1 4\n>...\n",
    { robot: { row: 0, col: 2 } },
  ],
  [
    "2.2.3",
    "turn by 0: az irány nem változik",
    "turn by 0",
    OPEN,
    { robot: { row: 1, col: 1, dir: "east" } },
  ],
  [
    "2.2.3",
    "turn by 1: balra, kelet → észak",
    "turn by 1",
    OPEN,
    { robot: { row: 1, col: 1, dir: "north" } },
  ],
  [
    "2.2.3",
    "turn by 2: kelet → nyugat",
    "turn by 2",
    OPEN,
    { robot: { row: 1, col: 1, dir: "west" } },
  ],
  [
    "2.2.3",
    "turn by 3: kelet → dél",
    "turn by 3",
    OPEN,
    { robot: { row: 1, col: 1, dir: "south" } },
  ],
  [
    "2.2.3",
    "turn by 4: körbefordul, kelet",
    "turn by 4",
    OPEN,
    { robot: { row: 1, col: 1, dir: "east" } },
  ],
  [
    "2.2.3",
    "turn by 1 észak felől: nyugat",
    "turn by 1",
    "3 3\n...\n.^.\n...\n",
    { robot: { row: 1, col: 1, dir: "west" } },
  ],
  [
    "2.2.3",
    "a fordulás után előre lépés az új irányba visz",
    "turn by 1\nstep forward 1",
    OPEN,
    { robot: { row: 0, col: 1, dir: "north" } },
  ],
  [
    "2.2.3",
    "mine here: kibányássza, az arany száma 1",
    "step forward 1\nmine here",
    "1 2\n>@\n",
    { kind: "ok", gold: 1 },
  ],
  [
    "2.2.3",
    "mine here: utána ugyanott nincs több arany (E_NO_GOLD)",
    "step forward 1\nmine here\nmine here",
    "1 2\n>@\n",
    { code: "E_NO_GOLD", line: 3, gold: 1 },
  ],
  [
    "2.2.3",
    "kibányászás után az isThere 2 a mezőre hamis",
    "step forward 1\nmine here\nturn by 2\nstep forward 1\nturn by 2\nset a to isThere 2\nprint a",
    "1 3\n.>@\n",
    { console: ["false"] },
  ],
  [
    "2.2.3",
    "isThere a térkép szélén túl falat lát: isThere 1 igaz",
    "set a to isThere 1\nprint a",
    DOT,
    { console: ["true"] },
  ],
  [
    "2.2.3",
    "isThere a térkép szélén túl: isThere 0 hamis",
    "set a to isThere 0\nprint a",
    DOT,
    { console: ["false"] },
  ],
  [
    "2.2.3",
    "isThere a térkép szélén túl: isThere 2 hamis",
    "set a to isThere 2\nprint a",
    DOT,
    { console: ["false"] },
  ],
  [
    "2.2.3",
    "az isThere által vizsgált mező felfedezett lesz",
    "set a to isThere 0",
    "1 3\n>..\n",
    {
      discovered: [
        [0, 0],
        [0, 1],
      ],
    },
  ],
  [
    "2.2.3",
    "print egész értéket tízes számrendszerben ír ki",
    "print 42",
    DOT,
    { console: ["42"] },
  ],
  [
    "2.2.3",
    "print logikai értéket true/false alakban ír ki",
    "print true\nprint false",
    DOT,
    { console: ["true", "false"] },
  ],
]);

runCases("2.2.4 Futásidejű hibák", [
  [
    "2.2.4",
    "E_TYPE_MISMATCH: rögzített típusú változóhoz eltérő típus",
    "set a to 1\nset a to false",
    DOT,
    { code: "E_TYPE_MISMATCH", line: 2, steps: 2 },
  ],
  [
    "2.2.4",
    "E_UNINITIALIZED: értékadás előtti olvasás",
    "print x",
    DOT,
    { code: "E_UNINITIALIZED", line: 1, steps: 1 },
  ],
  [
    "2.2.4",
    "E_NON_BOOL_CONDITION: egész if-feltétel változóból",
    "set n to 1\nif n\n  print 1",
    DOT,
    { code: "E_NON_BOOL_CONDITION", line: 2 },
  ],
  [
    "2.2.4",
    "E_BAD_OPERAND: logikai művelet egésszel",
    "set a to 1 or 2",
    DOT,
    { code: "E_BAD_OPERAND", line: 1 },
  ],
  [
    "2.2.4",
    "E_BEDROCK_HIT: falra lépés",
    "step forward 1",
    "1 2\n>#\n",
    { code: "E_BEDROCK_HIT", line: 1, robot: { row: 0, col: 0 } },
  ],
  [
    "2.2.4",
    "E_BEDROCK_HIT: lelépés a térképről",
    "step forward 1",
    DOT,
    { code: "E_BEDROCK_HIT", line: 1, robot: { row: 0, col: 0 } },
  ],
  [
    "2.2.4",
    "E_BEDROCK_HIT a soron következő lépésnél: a falig megtett lépések megtörténnek",
    "step forward 2",
    "1 3\n>.#\n",
    { code: "E_BEDROCK_HIT", line: 1, robot: { row: 0, col: 1 } },
  ],
  ["2.2.4", "E_NO_GOLD: bányászás üres mezőn", "mine here", DOT, { code: "E_NO_GOLD", line: 1 }],
  ["2.2.4", "E_BAD_ARG: isThere 3", "set a to isThere 3", DOT, { code: "E_BAD_ARG", line: 1 }],
  [
    "2.2.4",
    "E_BAD_ARG: turn by true (a kiírás példája)",
    "turn by true",
    DOT,
    { code: "E_BAD_ARG", line: 1 },
  ],
  [
    "2.2.4",
    "E_BAD_ARG: isThere logikai paraméterrel",
    "set a to isThere true",
    DOT,
    { code: "E_BAD_ARG", line: 1 },
  ],
  [
    "2.2.4",
    "E_BAD_ARG: step forward logikai paraméterrel",
    "step forward false",
    DOT,
    { code: "E_BAD_ARG", line: 1 },
  ],
  [
    "2.2.4",
    "E_BAD_ARG: negatív step forward (n nemnegatív)",
    "set n to 0 - 1\nstep forward n",
    DOT,
    { code: "E_BAD_ARG", line: 2 },
  ],
  [
    "2.2.4",
    "E_BAD_ARG: negatív turn by (n nemnegatív)",
    "set n to 0 - 2\nturn by n",
    DOT,
    { code: "E_BAD_ARG", line: 2 },
  ],
  [
    "2.2.4",
    "hiba után a végrehajtás befejeződik: a további sorok nem futnak",
    "print 1\nprint x\nprint 2",
    DOT,
    { code: "E_UNINITIALIZED", line: 2, steps: 2, console: ["1"] },
  ],
]);

const ones = (count: number) => Array.from({ length: count }, () => "1");

runCases("3.4 A futtatás és a lépésszámlálás", [
  ["3.4", "minden végrehajtott sor egynek számít", "print 1\nprint 2", DOT, { steps: 2 }],
  [
    "3.4",
    "a ciklustörzs sorai minden lefutáskor, a while sora minden kiértékelésnél számít: 2 + 3×3 + 1 = 12",
    "set i to 0\nset c to i < 3\nwhile c\n  set i to i + 1\n  set c to i < 3",
    DOT,
    { kind: "ok", steps: 12 },
  ],
  [
    "3.4",
    "az else sora nem számít, ha az if feltétele igaz: 2 lépés",
    "if true\n  print 1\nelse\n  print 2",
    DOT,
    { steps: 2 },
  ],
  [
    "3.4",
    "az else sora számít, ha az else ág lefut: 3 lépés",
    "if false\n  print 1\nelse\n  print 2",
    DOT,
    { steps: 3 },
  ],
  [
    "3.4",
    "pontosan 1000 feldolgozott sor: nincs hiba",
    "print 1\n".repeat(1000),
    DOT,
    { kind: "ok", steps: 1000, console: ones(1000) },
  ],
  [
    "3.4",
    "az 1001. sor előtt INSTRUCTION_COUNT_LIMIT_EXCEEDED, az 1000. még lefut",
    "print 1\n".repeat(1001),
    DOT,
    { code: "INSTRUCTION_COUNT_LIMIT_EXCEEDED", line: 1001, steps: 1000, console: ones(1000) },
  ],
  [
    "3.4",
    "végtelen ciklus: a limit a while sorában állít meg, 500 kiírás után",
    "while true\n  print 1",
    DOT,
    { code: "INSTRUCTION_COUNT_LIMIT_EXCEEDED", line: 1, steps: 1000, console: ones(500) },
  ],
  ["3.4", "a futás véget érhet a program végén hiba nélkül", "print 1", DOT, { kind: "ok" }],
  [
    "3.4",
    "a kibányászott arany és a lépésszám a futás eredménye",
    "step forward 1\nmine here\nstep forward 1\nmine here",
    "1 3\n>@@\n",
    { gold: 2, steps: 4 },
  ],
]);

describe("3. Indításkor a térkép és a robot alaphelyzetbe kerül", () => {
  test("[3] két egymás utáni futás azonos eredményt ad: a kibányászott arany a következő futásban újra ott van", () => {
    for (const [label, execute] of runners()) {
      const first = execute("step forward 1\nmine here", "1 2\n>@\n");
      const second = execute("step forward 1\nmine here", "1 2\n>@\n");
      expect(`${label}: ${first.gold} ${second.gold} ${second.outcome.kind}`).toBe(
        `${label}: 1 1 ok`,
      );
      expect(`${label} kezdőhely: ${second.events[0]?.robot.pos.col}`).toBe(
        `${label} kezdőhely: 1`,
      );
    }
  });
});
