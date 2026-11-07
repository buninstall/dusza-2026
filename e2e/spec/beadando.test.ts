import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "..", "..");
const path = join(root, "docs", "beadando.md");
const text = existsSync(path) ? readFileSync(path, "utf8") : "";
const lower = text.toLowerCase();
const headings = text
  .split("\n")
  .filter((line) => /^#{1,4} /.test(line))
  .map((line) => line.replace(/^#+ /, "").toLowerCase());

function section(pattern: RegExp): string {
  const lines = text.split("\n");
  const start = lines.findIndex(
    (line) => /^#{1,4} /.test(line) && pattern.test(line.toLowerCase()),
  );
  if (start < 0) return "";
  const level = (lines[start]?.match(/^#+/)?.[0] ?? "##").length;
  const end = lines.findIndex(
    (line, index) => index > start && new RegExp(`^#{1,${level}} `).test(line),
  );
  return lines
    .slice(start + 1, end < 0 ? undefined : end)
    .join("\n")
    .trim();
}

describe("4. Beadandó: a működés rövid leírása", () => {
  test("[4] a beadandó leírás létezik (docs/beadando.md)", () => {
    expect(text.length).toBeGreaterThan(500);
  });

  const REQUIRED: [string, RegExp][] = [
    ["melyik funkciót hogyan lehet elérni", /funkci/],
    ["mely részek nem készültek el vagy kimaradtak", /nem készült|kimaradt/],
    ["melyek számítanak plusz szolgáltatásnak", /plusz|többlet/],
    ["milyen problémák merültek fel, és hogyan sikerült megoldani", /problém/],
    ["ötletek, javaslatok a továbbfejlesztésre", /továbbfejleszt/],
  ];
  for (const [name, pattern] of REQUIRED) {
    test(`[4] van külön, nem üres fejezet: ${name}`, () => {
      expect(`${name}: ${headings.some((heading) => pattern.test(heading))}`).toBe(`${name}: true`);
      expect(`${name} tartalma: ${section(pattern).length > 40}`).toBe(`${name} tartalma: true`);
    });
  }

  const FEATURES: [string, RegExp][] = [
    ["bejelentkezés és felhasználókezelés", /bejelentkez|belép/],
    ["térképszerkesztő", /térképszerkeszt|szerkesztő/],
    ["térkép importálása és exportálása", /import/],
    ["program importálása és szerkesztése", /kódszerkeszt|programszerkeszt|szerkeszt/],
    ["a program futtatása", /futtat/],
    ["ranglista", /ranglist/],
  ];
  for (const [name, pattern] of FEATURES) {
    test(`[3, 4] a funkciók elérése között szerepel: ${name}`, () => {
      expect(`${name}: ${pattern.test(section(/funkci/).toLowerCase())}`).toBe(`${name}: true`);
    });
  }

  const CRITERIA: [string, RegExp][] = [
    ["hibátlan működés (tesztelés)", /teszt/],
    ["áttekinthető, esztétikus megjelenés", /megjelen|dizájn|design|felület/],
    ["akadálymentes használhatóság", /akadálymentes|a11y|billentyűzet/],
    ["jól olvasható, rendezett forráskód", /forráskód|kód/],
  ];
  for (const [name, pattern] of CRITERIA) {
    test(`[4] az értékelési szempont meg van említve: ${name}`, () => {
      expect(`${name}: ${pattern.test(lower)}`).toBe(`${name}: true`);
    });
  }

  test("[4] a bemutatóhoz kész játékkörnyezet le van írva (demófiókok, indítás)", () => {
    expect(/demo|demó/.test(lower)).toBe(true);
    expect(/indít/.test(lower)).toBe(true);
  });
});
