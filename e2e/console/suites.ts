import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import type { Severity, TestCase } from "./parsers.ts";
import { probeWrites } from "./probes.ts";
import { probeLive, type ScanContext, scanComments, scanHygiene, scanSecrets } from "./scanners.ts";
import type { Target } from "./store.ts";

export const root = join(import.meta.dir, "..", "..");
const LIVE_PRELOAD = join(import.meta.dir, "live-preload.ts");
const bun = process.execPath;

export type Parser =
  | "junit"
  | "playwright"
  | "libtest"
  | "biome"
  | "typecheck"
  | "rust-diagnostics"
  | "audit"
  | "lcov"
  | "none";

export type Command = {
  cmd: string[];
  cwd: string;
  env: Record<string, string>;
  reportFile: string | null;
  parser: Parser;
  reportBase: string | null;
};

export type Options = { randomizeSeed: number | null; baseUrl: string; deep: boolean };

export type Builtin = (context: ScanContext, options: Options) => Promise<TestCase[]>;

export type Suite = {
  id: string;
  group: string;
  title: string;
  description: string;
  severity: Severity;
  long: boolean;
  needs: string[];
  targets: "bun" | "vitest" | "playwright" | "cargo" | "none";
  testRoot: string | null;
  command?: (target: Target | null, options: Options, reportFile: string) => Command;
  builtin?: Builtin;
  reportName?: string;
};

function databaseEnv(): Record<string, string> {
  return {
    TEST_DATABASE_URL: process.env.TEST_DATABASE_URL ?? "mysql://root:minescript@127.0.0.1:3306",
    DATABASE_URL:
      process.env.DATABASE_URL ?? "mysql://minescript:minescript@127.0.0.1:3306/minescript",
  };
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function namePattern(name: string): string {
  const own = name.split(" › ").at(-1) ?? name;
  return own
    .split(/\$\{[^}]*\}/)
    .map(escapeRegex)
    .join(".*");
}

function bunTest(cwd: string, defaultFiles: string[], extraEnv: Record<string, string> = {}) {
  return (target: Target | null, options: Options, reportFile: string): Command => {
    const files = target?.file
      ? [relative(join(root, cwd), join(root, target.file)).replaceAll("\\", "/")]
      : defaultFiles;
    const cmd = [
      bun,
      "test",
      "--preload",
      LIVE_PRELOAD,
      ...files.map((file) => (file.startsWith(".") ? file : `./${file}`)),
    ];
    if (target?.name) cmd.push("--test-name-pattern", namePattern(target.name));
    if (options.randomizeSeed !== null)
      cmd.push("--randomize", "--seed", String(options.randomizeSeed));
    cmd.push("--reporter=junit", `--reporter-outfile=${reportFile}`);
    return {
      cmd,
      cwd: join(root, cwd),
      env: { ...databaseEnv(), ...extraEnv },
      reportFile,
      parser: "junit",
      reportBase: cwd,
    };
  };
}

const deepEnv = (options: Options): Record<string, string> =>
  options.deep ? { FUZZ_SEEDS: "20000", PROPERTY_SEEDS: "5000", DIFF_SEEDS: "20000" } : {};

export const SUITES: Suite[] = [
  {
    id: "rust-unit",
    group: "Rust-motor",
    title: "Rust egység- és tulajdonságtesztek",
    description:
      "cargo test --workspace: a core (szintaxis, formázó, linter, IDE, térkép, futtató), a WASM-kötés, a CLI és a bench minden tesztje, a conformance-szel és a mély beágyazással együtt.",
    severity: "magas",
    long: false,
    needs: [],
    targets: "cargo",
    testRoot: "crates",
    command: (target) => ({
      cmd: [
        "cargo",
        "test",
        "--workspace",
        "--no-fail-fast",
        ...(target?.name ? ["--", target.name, "--exact"] : []),
      ],
      cwd: root,
      env: { CARGO_TERM_COLOR: "never" },
      reportFile: null,
      parser: "libtest",
      reportBase: null,
    }),
  },
  {
    id: "rust-conformance",
    group: "Rust-motor",
    title: "Conformance a Rust-motoron",
    description:
      "A conformance/ összes runtime-, szintaxis- és térképesete a Rust core-on (az elvárt értékek a specből és a D-döntésekből).",
    severity: "blokkoló",
    long: false,
    needs: [],
    targets: "none",
    testRoot: null,
    command: () => ({
      cmd: ["cargo", "test", "-p", "minescript-core", "--test", "conformance", "--no-fail-fast"],
      cwd: root,
      env: { CARGO_TERM_COLOR: "never" },
      reportFile: null,
      parser: "libtest",
      reportBase: null,
    }),
  },
  {
    id: "rust-clippy",
    group: "Statikus elemzés",
    title: "Clippy (-D warnings)",
    description:
      "cargo clippy --workspace --all-targets: minden figyelmeztetés hibának számít, fájl és sor szerint.",
    severity: "közepes",
    long: false,
    needs: [],
    targets: "none",
    testRoot: null,
    command: () => ({
      cmd: ["cargo", "clippy", "--workspace", "--all-targets", "--", "-D", "warnings"],
      cwd: root,
      env: { CARGO_TERM_COLOR: "never" },
      reportFile: null,
      parser: "rust-diagnostics",
      reportBase: null,
    }),
  },
  {
    id: "rust-fmt",
    group: "Statikus elemzés",
    title: "rustfmt ellenőrzés",
    description: "cargo fmt --all --check: minden formázatlan Rust-fájl.",
    severity: "alacsony",
    long: false,
    needs: [],
    targets: "none",
    testRoot: null,
    command: () => ({
      cmd: ["cargo", "fmt", "--all", "--check"],
      cwd: root,
      env: {},
      reportFile: null,
      parser: "rust-diagnostics",
      reportBase: null,
    }),
  },
  {
    id: "wasm-build",
    group: "Előkészítés",
    title: "WASM-motor fordítása",
    description:
      "just wasm: a packages/engine/pkg újraépítése. A WASM-et használó tesztek előtt futtasd, ha a crates/ változott.",
    severity: "magas",
    long: false,
    needs: [],
    targets: "none",
    testRoot: null,
    command: () => ({
      cmd: ["just", "wasm"],
      cwd: root,
      env: {},
      reportFile: null,
      parser: "none",
      reportBase: null,
    }),
  },
  {
    id: "web-build",
    group: "Előkészítés",
    title: "Teljes build (wasm, web, manifest, migrációk)",
    description: "just build: az e2e és a kliens csomag titokkeresése ezt használja.",
    severity: "magas",
    long: true,
    needs: [],
    targets: "none",
    testRoot: null,
    command: () => ({
      cmd: ["just", "build"],
      cwd: root,
      env: {},
      reportFile: null,
      parser: "none",
      reportBase: null,
    }),
  },
  {
    id: "engine",
    group: "Rust-motor",
    title: "@minescript/engine (WASM) tesztek és conformance",
    description:
      "A TS-burok tesztjei és a teljes conformance-csomag a böngészőben is futó WASM-motoron.",
    severity: "blokkoló",
    long: false,
    needs: ["wasm"],
    targets: "bun",
    testRoot: "packages/engine/test",
    command: bunTest("packages/engine", ["test"]),
  },
  {
    id: "reference",
    group: "Referencia és orákulum",
    title: "Referencia-interpreter: unit, differenciális, mutációs, invariáns, robusztussági, fuzz",
    description:
      "A független, spec-hű referencia minden tesztje: 37 mutáns, referencia ↔ WASM differenciális teszt, metamorf és invariáns tesztek, szintaxis-, térkép- és robot-API-fuzz, óriási bemenetek, komment-mentesség.",
    severity: "blokkoló",
    long: false,
    needs: ["wasm"],
    targets: "bun",
    testRoot: "tools/reference-interpreter/test",
    command: (target, options, reportFile) =>
      bunTest("tools/reference-interpreter", ["test"], deepEnv(options))(
        target,
        options,
        reportFile,
      ),
  },
  {
    id: "fuzz-deep",
    group: "Referencia és orákulum",
    title: "Mély fuzz (20 000 seed)",
    description: "A differenciális, invariáns és fuzz tesztek tízszeres seedszámmal. Hosszú futás.",
    severity: "blokkoló",
    long: true,
    needs: ["wasm"],
    targets: "none",
    testRoot: null,
    command: (target, options, reportFile) =>
      bunTest(
        "tools/reference-interpreter",
        ["test/diff.test.ts", "test/properties.test.ts", "test/fuzz.test.ts"],
        { FUZZ_SEEDS: "20000", PROPERTY_SEEDS: "5000", DIFF_SEEDS: "20000" },
      )(target, options, reportFile),
  },
  {
    id: "server",
    group: "Szerver és web",
    title: "Szerver (Hono API) tesztek",
    description:
      "Auth, CSRF, hardening, térképek, programok, futások, ranglista, admin: ideiglenes MySQL-adatbázissal (TEST_DATABASE_URL).",
    severity: "magas",
    long: false,
    needs: ["db"],
    targets: "bun",
    testRoot: "apps/server/test",
    command: bunTest("apps/server", ["test"]),
  },
  {
    id: "web",
    group: "Szerver és web",
    title: "Webes felület unit tesztjei (Vitest)",
    description: "A React SPA komponens- és logikatesztjei.",
    severity: "közepes",
    long: false,
    needs: [],
    targets: "vitest",
    testRoot: "apps/web/src",
    command: (target, _options, reportFile) => {
      const cmd = [
        bun,
        "run",
        "test",
        "--reporter=default",
        "--reporter=junit",
        `--outputFile.junit=${reportFile}`,
      ];
      if (target?.file)
        cmd.push(relative(join(root, "apps/web"), join(root, target.file)).replaceAll("\\", "/"));
      if (target?.name) cmd.push("-t", namePattern(target.name));
      return {
        cmd,
        cwd: join(root, "apps/web"),
        env: { CI: "1" },
        reportFile,
        parser: "junit",
        reportBase: "apps/web",
      };
    },
  },
  {
    id: "e2e",
    group: "Végponttól végpontig",
    title: "Playwright E2E: folyamatok, biztonság, akadálymentesség, reszponzivitás",
    description:
      "Az összes e2e spec Chromiumban, ideiglenes adatbázissal (8090-es port). Előtte kell a teljes build.",
    severity: "magas",
    long: true,
    needs: ["db", "build"],
    targets: "playwright",
    testRoot: "e2e",
    command: (target, _options, reportFile) => {
      const cmd = [bun, "run", "e2e", "--reporter=list,json"];
      if (target?.file) {
        const file = relative(join(root, "e2e"), join(root, target.file)).replaceAll("\\", "/");
        cmd.push(target.line ? `${file}:${target.line}` : file);
      }
      return {
        cmd,
        cwd: join(root, "e2e"),
        env: { ...databaseEnv(), PLAYWRIGHT_JSON_OUTPUT_NAME: reportFile, FORCE_COLOR: "0" },
        reportFile,
        parser: "playwright",
        reportBase: "e2e",
      };
    },
  },
  {
    id: "static-biome",
    group: "Statikus elemzés",
    title: "Biome (lint és formázás)",
    description: "bunx biome ci .: lint- és formázási hibák fájl és sor szerint.",
    severity: "közepes",
    long: false,
    needs: [],
    targets: "none",
    testRoot: null,
    command: () => ({
      cmd: [bun, "x", "biome", "ci", ".", "--reporter=github", "--max-diagnostics=none"],
      cwd: root,
      env: {},
      reportFile: null,
      parser: "biome",
      reportBase: null,
    }),
  },
  {
    id: "static-typecheck",
    group: "Statikus elemzés",
    title: "TypeScript típusellenőrzés minden workspace-ben",
    description: "bun run --filter '*' typecheck: minden típushiba fájl, sor és TS-kód szerint.",
    severity: "közepes",
    long: false,
    needs: [],
    targets: "none",
    testRoot: null,
    command: () => ({
      cmd: [bun, "run", "--filter", "*", "typecheck"],
      cwd: root,
      env: { FORCE_COLOR: "0" },
      reportFile: null,
      parser: "typecheck",
      reportBase: null,
    }),
  },
  {
    id: "static-audit",
    group: "Biztonság",
    title: "Függőség-audit (bun audit)",
    description:
      "Ismert sérülékenységek a telepített JS-függőségekben, súlyosság szerint. Csak olvas, semmit nem módosít.",
    severity: "magas",
    long: false,
    needs: ["network"],
    targets: "none",
    testRoot: null,
    command: () => ({
      cmd: [bun, "audit", "--json"],
      cwd: root,
      env: {},
      reportFile: null,
      parser: "audit",
      reportBase: null,
    }),
  },
  {
    id: "static-secrets",
    group: "Biztonság",
    title: "Titokkeresés a repóban és a kliens buildben",
    description:
      "Privát kulcsok, API-kulcsok, tokenek, kódba írt jelszavak, jelszót tartalmazó URL-ek, nagy entrópiájú értékek, .env és kulcsfájlok, source map a buildben.",
    severity: "blokkoló",
    long: false,
    needs: [],
    targets: "none",
    testRoot: null,
    builtin: (context) => scanSecrets(context),
  },
  {
    id: "static-comments",
    group: "Csapatszabályok",
    title: "Nulla komment a teljes repóban",
    description:
      "Minden verziókezelt fájl (TS/JS, Rust, CSS, YAML, TOML, shell, SQL, Markdown, HTML) a CLAUDE.md 1. pontja szerint.",
    severity: "alacsony",
    long: false,
    needs: [],
    targets: "none",
    testRoot: null,
    builtin: (context) => scanComments(context),
  },
  {
    id: "static-hygiene",
    group: "Csapatszabályok",
    title: "Repó-higiénia",
    description:
      "Ütközésjelzők, CRLF, lokális és nagy fájlok, debugger/console.log/.only maradványok, kihagyott tesztek (.skip/.todo).",
    severity: "közepes",
    long: false,
    needs: [],
    targets: "none",
    testRoot: null,
    builtin: (context) => scanHygiene(context),
  },
  {
    id: "live-security",
    group: "Biztonság",
    title: "Élő biztonsági vizsgálat egy futó helyi példányon",
    description:
      "Fejlécek, hitelesítés nélküli hozzáférés, CORS, CSRF, információszivárgás, útvonal-bejárás, source map, HTTP-metódusok, brute force, túl nagy törzs, felhasználónév-felsorolás. Csak loopback címre.",
    severity: "magas",
    long: false,
    needs: ["live"],
    targets: "none",
    testRoot: null,
    builtin: (context, options) => probeLive(context, options.baseUrl),
  },
  {
    id: "live-write",
    group: "Biztonság",
    title: "Élő írási próbák: munkamenet, IDOR, tömeges értékadás, ranglista, versenyhelyzet",
    description:
      "Eldobható fiókokat és privát térképeket hoz létre a célpéldányon: süti-jelzők, jelszó a válaszban, kijelentkezés utáni süti, munkamenet-rögzítés, admin szerep a regisztrációban, betűméret-ütközés, IDOR, ranglista-hamisítás, 12 párhuzamos beküldés, óriási program, tárolt XSS. Csak tesztpéldányon futtasd.",
    severity: "blokkoló",
    long: false,
    needs: ["live"],
    targets: "none",
    testRoot: null,
    builtin: (context, options) =>
      probeWrites(new URL(options.baseUrl), context.log, context.signal),
  },
  {
    id: "coverage-reference",
    group: "Lefedettség",
    title: "Lefedettség: referencia-interpreter",
    description:
      "bun test --coverage: minden src-fájl sorlefedettsége, 95% alatt hiányosságként, a lefedetlen sorokkal.",
    severity: "alacsony",
    long: false,
    needs: ["wasm"],
    targets: "none",
    testRoot: null,
    reportName: "lcov.info",
    command: (_target, _options, reportFile) => ({
      cmd: [
        bun,
        "test",
        "./test",
        "--coverage",
        "--coverage-reporter=lcov",
        `--coverage-dir=${dirname(reportFile)}`,
      ],
      cwd: join(root, "tools/reference-interpreter"),
      env: {},
      reportFile,
      parser: "lcov",
      reportBase: "tools/reference-interpreter",
    }),
  },
  {
    id: "coverage-engine",
    group: "Lefedettség",
    title: "Lefedettség: @minescript/engine TS-burok",
    description:
      "A WASM-motor TypeScript-burkának sorlefedettsége a saját tesztjein és a conformance-en.",
    severity: "alacsony",
    long: false,
    needs: ["wasm"],
    targets: "none",
    testRoot: null,
    reportName: "lcov.info",
    command: (_target, _options, reportFile) => ({
      cmd: [
        bun,
        "test",
        "./test",
        "--coverage",
        "--coverage-reporter=lcov",
        `--coverage-dir=${dirname(reportFile)}`,
      ],
      cwd: join(root, "packages/engine"),
      env: {},
      reportFile,
      parser: "lcov",
      reportBase: "packages/engine",
    }),
  },
  {
    id: "coverage-server",
    group: "Lefedettség",
    title: "Lefedettség: szerver",
    description: "Az apps/server forrásainak sorlefedettsége a szervertesztekkel (MySQL kell).",
    severity: "alacsony",
    long: false,
    needs: ["db"],
    targets: "none",
    testRoot: null,
    reportName: "lcov.info",
    command: (_target, _options, reportFile) => ({
      cmd: [
        bun,
        "test",
        "./test",
        "--coverage",
        "--coverage-reporter=lcov",
        `--coverage-dir=${dirname(reportFile)}`,
      ],
      cwd: join(root, "apps/server"),
      env: databaseEnv(),
      reportFile,
      parser: "lcov",
      reportBase: "apps/server",
    }),
  },
  {
    id: "rust-proptest-deep",
    group: "Rust-motor",
    title: "Mély tulajdonságalapú tesztek (proptest, 20 000 eset)",
    description:
      "A core properties és deep_nesting tesztjei PROPTEST_CASES=20000 beállítással, release módban. Hosszú futás.",
    severity: "magas",
    long: true,
    needs: [],
    targets: "none",
    testRoot: null,
    command: () => ({
      cmd: [
        "cargo",
        "test",
        "--release",
        "-p",
        "minescript-core",
        "--test",
        "properties",
        "--test",
        "deep_nesting",
        "--no-fail-fast",
      ],
      cwd: root,
      env: { CARGO_TERM_COLOR: "never", PROPTEST_CASES: "20000" },
      reportFile: null,
      parser: "libtest",
      reportBase: null,
    }),
  },
  {
    id: "e2e-flaky",
    group: "Végponttól végpontig",
    title: "E2E instabilitás-próba (minden teszt háromszor)",
    description:
      "Playwright --repeat-each=3: minden e2e eset háromszor fut, a hol sikeres, hol sikertelen esetek instabilként jelennek meg.",
    severity: "közepes",
    long: true,
    needs: ["db", "build"],
    targets: "none",
    testRoot: null,
    command: (_target, _options, reportFile) => ({
      cmd: [bun, "run", "e2e", "--reporter=list,json", "--repeat-each=3"],
      cwd: join(root, "e2e"),
      env: { ...databaseEnv(), PLAYWRIGHT_JSON_OUTPUT_NAME: reportFile, FORCE_COLOR: "0" },
      reportFile,
      parser: "playwright",
      reportBase: "e2e",
    }),
  },
  {
    id: "kiiras-engine",
    group: "Versenykiírás (PDF)",
    title: "Kiírás: nyelv, térkép, robot API, hibák, lépésszámlálás",
    description:
      "A kiírás 1., 2., 2.1, 2.2.1–2.2.4 és 3.4 fejezetének minden szabálya külön tesztként, fejezetszámmal: a példatérkép és a két példaprogram kézzel levezetett eredménye, az EBNF minden ága, mind a 18 kulcsszó minden betűmérettel, a tokenizálás, a szemantika, a robot API, mind a 7 hibakód és az 1000 soros limit. A WASM-motoron és a referencián is fut.",
    severity: "blokkoló",
    long: false,
    needs: ["wasm"],
    targets: "bun",
    testRoot: "tools/reference-interpreter/test/kiiras.test.ts",
    command: bunTest("tools/reference-interpreter", ["test/kiiras.test.ts"]),
  },
  {
    id: "kiiras-live",
    group: "Versenykiírás (PDF)",
    title:
      "Kiírás: bejelentkezés, térképszerkesztő, programmentés, futtatás, ranglista (élő szerver)",
    description:
      "A 3.1–3.5 fejezet a futó alkalmazáson: bejelentkezés nélkül semmi nem érhető el, csak szabályos térkép menthető, a hibás program is menthető, a hibás program nem fut és nem rögzül, a futás aranya, lépésszáma és hibakódja a szerveré, a ranglista arany szerint csökkenő, egyenlőségnél lépés szerint növekvő, és van kész bemutató játékkörnyezet. Eldobható fiókokat hoz létre.",
    severity: "blokkoló",
    long: false,
    needs: ["live"],
    targets: "bun",
    testRoot: "e2e/spec/kiiras-live.test.ts",
    command: (target, options, reportFile) =>
      bunTest("e2e", ["spec/kiiras-live.test.ts"], { KIIRAS_TARGET: options.baseUrl })(
        target,
        options,
        reportFile,
      ),
  },
  {
    id: "kiiras-ui",
    group: "Versenykiírás (PDF)",
    title: "Kiírás: a felület követelményei böngészőben (Playwright)",
    description:
      "A 3. fejezet felületi elvárásai: lassított futás az éppen végrehajtott sor kiemelésével, konzol, felfedezett mezők, hibakód és hibasor kijelzése, leállítás, térképszerkesztő szabályai, import és export, hibás fájl érthető hibaüzenettel, ranglista, bejelentkezés. Előtte kell a teljes build.",
    severity: "magas",
    long: true,
    needs: ["db", "build"],
    targets: "none",
    testRoot: null,
    command: (_target, _options, reportFile) => ({
      cmd: [
        bun,
        "run",
        "e2e",
        "--reporter=list,json",
        "run.spec.ts",
        "play.spec.ts",
        "program.spec.ts",
        "map-editor.spec.ts",
        "map-rules.spec.ts",
        "leaderboard.spec.ts",
        "auth.spec.ts",
        "smoke.spec.ts",
      ],
      cwd: join(root, "e2e"),
      env: { ...databaseEnv(), PLAYWRIGHT_JSON_OUTPUT_NAME: reportFile, FORCE_COLOR: "0" },
      reportFile,
      parser: "playwright",
      reportBase: "e2e",
    }),
  },
  {
    id: "kiiras-beadando",
    group: "Versenykiírás (PDF)",
    title: "Kiírás 4. fejezet: a beadandó leírás teljessége",
    description:
      "A docs/beadando.md-ben külön, nem üres fejezet szól a funkciók eléréséről, a kimaradt részekről, a plusz szolgáltatásokról, a problémákról és megoldásaikról, a továbbfejlesztési ötletekről; mind a hat alapfunkció és mind a négy értékelési szempont szerepel, és le van írva a bemutató játékkörnyezet.",
    severity: "közepes",
    long: false,
    needs: [],
    targets: "bun",
    testRoot: "e2e/spec/beadando.test.ts",
    command: bunTest("e2e", ["spec/beadando.test.ts"]),
  },
  {
    id: "console-self",
    group: "Tesztkonzol",
    title: "A tesztkonzol önellenőrzése",
    description:
      "A konzol saját tesztjei: jelszókapu, munkamenet, CSRF, Host-ellenőrzés, fejlécek, elemzők.",
    severity: "magas",
    long: false,
    needs: [],
    targets: "bun",
    testRoot: "e2e/console",
    command: bunTest("e2e/console", ["console.test.ts"]),
  },
];

export type DiscoveredTest = { file: string; name: string; line: number | null };

function filesIn(dir: string, pattern: RegExp): string[] {
  if (!existsSync(dir)) return [];
  if (statSync(dir).isFile()) return pattern.test(dir) ? [dir] : [];
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "node_modules" ? [] : filesIn(path, pattern);
    return pattern.test(name) ? [path] : [];
  });
}

function staticTests(dir: string, pattern: RegExp): DiscoveredTest[] {
  return filesIn(join(root, dir), pattern).flatMap((path) => {
    const file = relative(root, path).replaceAll("\\", "/");
    const text = readFileSync(path, "utf8");
    const tests: DiscoveredTest[] = [{ file, name: "", line: null }];
    for (const match of text.matchAll(
      /\b(?:test|it)(?:\.each\([^)]*\))?\(\s*(["'`])((?:\\.|(?!\1).)*)\1/g,
    )) {
      const line = text.slice(0, match.index ?? 0).split("\n").length;
      tests.push({ file, name: match[2] ?? "", line });
    }
    return tests;
  });
}

async function output(
  cmd: string[],
  cwd: string,
  env: Record<string, string> = {},
): Promise<string> {
  const child = Bun.spawn(cmd, {
    cwd,
    env: { ...process.env, ...env },
    stdout: "pipe",
    stderr: "pipe",
  });
  const [text] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  await child.exited;
  return text;
}

type PwListSuite = {
  title?: string;
  file?: string;
  specs?: { title?: string; file?: string; line?: number }[];
  suites?: PwListSuite[];
};

export async function discover(suite: Suite): Promise<DiscoveredTest[]> {
  if (suite.targets === "bun" && suite.testRoot) return staticTests(suite.testRoot, /\.test\.ts$/);
  if (suite.targets === "vitest" && suite.testRoot)
    return staticTests(suite.testRoot, /\.test\.tsx?$/);
  if (suite.targets === "playwright") {
    const text = await output(
      [bun, "x", "playwright", "test", "--list", "--reporter=json"],
      join(root, "e2e"),
    );
    const start = text.indexOf("{");
    const report = JSON.parse(start >= 0 ? text.slice(start) : "{}") as { suites?: PwListSuite[] };
    const tests: DiscoveredTest[] = [];
    const files = new Set<string>();
    const walk = (node: PwListSuite, trail: string[]) => {
      const here = node.file && node.title === node.file ? trail : [...trail, node.title ?? ""];
      for (const spec of node.specs ?? []) {
        const file = `e2e/${(spec.file ?? node.file ?? "").replaceAll("\\", "/")}`;
        if (!files.has(file)) {
          files.add(file);
          tests.push({ file, name: "", line: null });
        }
        tests.push({
          file,
          name: [...here.filter(Boolean), spec.title ?? ""].join(" › "),
          line: spec.line ?? null,
        });
      }
      for (const child of node.suites ?? []) walk(child, here);
    };
    for (const node of report.suites ?? []) walk(node, []);
    return tests;
  }
  if (suite.targets === "cargo") {
    const text = await output(
      ["cargo", "test", "--workspace", "--", "--list", "--format", "terse"],
      root,
      { CARGO_TERM_COLOR: "never" },
    );
    return [...text.matchAll(/^(\S+): test$/gm)].map((match) => ({
      file: "crates",
      name: match[1] ?? "",
      line: null,
    }));
  }
  return [];
}
