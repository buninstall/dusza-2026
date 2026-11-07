import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = join(import.meta.dir, "..", "..", "..");
const OWNED = ["conformance", "tools/reference-interpreter", "e2e"];
const SKIPPED_DIRS = new Set(["node_modules", "test-results", "playwright-report", ".cache"]);
const SLASH = "/";
const STAR = "*";
const TICK = "`";
const DOLLAR = "$";
const REGEX_PREFIX = new Set([
  "",
  "(",
  ",",
  "=",
  ":",
  "[",
  "!",
  "&",
  "|",
  "?",
  "{",
  "}",
  ";",
  "+",
  "-",
]);

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return SKIPPED_DIRS.has(name) ? [] : filesUnder(path);
    return [path];
  });
}

export function scriptComments(text: string): number[] {
  const found: number[] = [];
  const braces: ("code" | "template")[] = [];
  let line = 1;
  let index = 0;
  let previous = "";
  const skipQuoted = (quote: string) => {
    index += 1;
    while (index < text.length && text[index] !== quote) {
      if (text[index] === "\\") index += 1;
      else if (text[index] === "\n") line += 1;
      index += 1;
    }
    index += 1;
  };
  const skipTemplate = () => {
    index += 1;
    while (index < text.length) {
      const char = text[index];
      if (char === "\\") index += 2;
      else if (char === "`") {
        index += 1;
        return;
      } else if (char === "$" && text[index + 1] === "{") {
        braces.push("template");
        index += 2;
        return;
      } else {
        if (char === "\n") line += 1;
        index += 1;
      }
    }
  };
  while (index < text.length) {
    const char = text[index] ?? "";
    const next = text[index + 1] ?? "";
    if (char === "\n") {
      line += 1;
      index += 1;
      continue;
    }
    if (char === " " || char === "\t" || char === "\r") {
      index += 1;
      continue;
    }
    if (char === SLASH && (next === SLASH || next === STAR)) {
      found.push(line);
      const end =
        next === SLASH ? text.indexOf("\n", index) : text.indexOf(STAR + SLASH, index + 2);
      const stop = end < 0 ? text.length : end;
      line += (text.slice(index, stop).match(/\n/g) ?? []).length;
      index = next === SLASH ? stop : stop + 2;
      continue;
    }
    if (char === "'" || char === '"') {
      skipQuoted(char);
      previous = "x";
      continue;
    }
    if (char === "`") {
      skipTemplate();
      previous = "x";
      continue;
    }
    if (char === "{") braces.push("code");
    if (char === "}" && braces.pop() === "template") {
      index -= 1;
      skipTemplate();
      previous = "x";
      continue;
    }
    if (
      char === SLASH &&
      (REGEX_PREFIX.has(previous) ||
        /\$\{\s*$/.test(text.slice(Math.max(0, index - 8), index)) ||
        /return$/.test(text.slice(0, index).trimEnd()))
    ) {
      index += 1;
      let inClass = false;
      while (index < text.length && (text[index] !== SLASH || inClass)) {
        if (text[index] === "\\") index += 1;
        else if (text[index] === "[") inClass = true;
        else if (text[index] === "]") inClass = false;
        index += 1;
      }
      index += 1;
      previous = "x";
      continue;
    }
    previous = /[A-Za-z0-9_$)\]]/.test(char) ? "x" : char;
    index += 1;
  }
  return found;
}

describe("a saját terület komment-mentes", () => {
  test("a felismerő megtalálja a kommentet, és nem téveszti meg az URL, a regex és a sablon", () => {
    const sample = [
      `const url = "https:${SLASH}${SLASH}example.test";`,
      `const re = ${SLASH}a\\${SLASH}${SLASH}b${SLASH}g;`,
      `const t = ${TICK}x ${DOLLAR}{1 + 2} ${SLASH}${SLASH} y${TICK};`,
      `const a = 1; ${SLASH}${SLASH} itt komment`,
      `${SLASH}${STAR} blokk ${STAR}${SLASH}`,
    ].join("\n");
    expect(scriptComments(sample)).toEqual([4, 5]);
  });

  const files = OWNED.flatMap((dir) => filesUnder(join(root, dir)));

  test("nincs // vagy /* komment a TypeScript- és JavaScript-fájlokban", () => {
    const offenders = files
      .filter((path) => /\.(ts|tsx|js|mjs)$/.test(path))
      .flatMap((path) =>
        scriptComments(readFileSync(path, "utf8")).map((line) => `${relative(root, path)}:${line}`),
      );
    expect(offenders).toEqual([]);
  });

  test("minden JSON-fájl kommentek nélkül, szabványosan olvasható", () => {
    const broken = files
      .filter((path) => path.endsWith(".json"))
      .filter((path) => {
        try {
          JSON.parse(readFileSync(path, "utf8"));
          return false;
        } catch {
          return true;
        }
      })
      .map((path) => relative(root, path));
    expect(broken).toEqual([]);
  });

  test("nincs HTML-komment a Markdown- és HTML-fájlokban", () => {
    const opener = "<" + "!--";
    const offenders = files
      .filter((path) => /\.(md|html)$/.test(path))
      .filter((path) => readFileSync(path, "utf8").includes(opener))
      .map((path) => relative(root, path));
    expect(offenders).toEqual([]);
  });
});
