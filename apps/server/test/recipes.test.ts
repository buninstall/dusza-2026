import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import type { DiagCode, Engine, RunResult } from "@minescript/engine";
import { loadEngine } from "../src/engine.ts";
import { seedDemo } from "../src/seed/index.ts";
import { TUTORIAL_MAPS } from "../src/seed/maps.ts";
import { RECIPES, type Recipe, type RecipeOutcome } from "../src/seed/recipes.ts";
import { SANDBOX_MAPS } from "../src/seed/sandbox.ts";
import { createTestContext, json } from "./helpers.ts";

const recipesDir = join(import.meta.dir, "..", "..", "..", "docs", "receptek");

const INVALID_MAPS: Record<string, DiagCode> = {
  "hibas-fejlec.txt": "MAP_HEADER",
  "ismeretlen-jel.txt": "MAP_BAD_SYMBOL",
  "ket-robot.txt": "MAP_MULTIPLE_ROBOTS",
  "nincs-robot.txt": "MAP_NO_ROBOT",
  "rovid-sor.txt": "MAP_ROW_LENGTH",
  "tul-nagy.txt": "MAP_DIM_RANGE",
  "ures.txt": "MAP_EMPTY",
};

const engine: Engine = await loadEngine();

function filesUnder(dir: string, extension: string): string[] {
  return readdirSync(dir, { recursive: true, encoding: "utf8" })
    .filter((file) => file.endsWith(extension))
    .map((file) => relative(recipesDir, join(dir, file)).split("\\").join("/"))
    .sort();
}

function outcomeOf(result: RunResult): RecipeOutcome {
  const { outcome } = result;
  if (outcome.kind === "syntaxError") {
    return { kind: "syntaxError", lines: outcome.diagnostics.map((d) => d.span.line) };
  }
  if (outcome.kind === "runtimeError") {
    return { kind: "runtimeError", code: outcome.code, line: outcome.line, steps: result.steps };
  }
  return { kind: "ok", gold: result.gold, steps: result.steps };
}

function mapText(index: number): string {
  const tutorial = TUTORIAL_MAPS[index];
  if (!tutorial) {
    throw new Error(`Nincs ${index + 1}. oktató térkép.`);
  }
  return tutorial.content;
}

function recipeMap(recipe: Recipe): string {
  if (recipe.world !== "sandbox") {
    return mapText(recipe.mapIndex);
  }
  const sandbox = SANDBOX_MAPS[recipe.mapIndex];
  if (!sandbox) {
    throw new Error(`Nincs ${recipe.mapIndex + 1}. homokozó-térkép.`);
  }
  return sandbox.content;
}

describe("receptek (docs/receptek)", () => {
  for (const recipe of RECIPES) {
    test(`${recipe.file} pontosan a dokumentált eredményt adja`, () => {
      const result = engine.run(recipe.source, recipeMap(recipe));
      expect(outcomeOf(result)).toEqual(recipe.expected);
    });
  }

  test("minden pályához van hibátlan recept, amely az összes elérhető aranyat kibányássza", () => {
    TUTORIAL_MAPS.forEach((tutorial, index) => {
      const parsed = engine.parseMap(tutorial.content);
      if (!parsed.map) {
        throw new Error(`Érvénytelen oktató térkép: ${tutorial.title}`);
      }
      const reachable = engine.mapInfo(parsed.map).reachableGold;
      const best = RECIPES.filter(
        (recipe) =>
          recipe.world === undefined && recipe.mapIndex === index && recipe.expected.kind === "ok",
      );
      expect(best.length).toBeGreaterThan(0);
      for (const recipe of best) {
        expect(engine.run(recipe.source, tutorial.content).gold).toBe(reachable);
      }
    });
  });

  test("a homokozó minden pályájához van bemutató recept, és a fájlok egyeznek", () => {
    SANDBOX_MAPS.forEach((sandbox, index) => {
      const recipe = RECIPES.find((item) => item.world === "sandbox" && item.mapIndex === index);
      expect(recipe).toBeDefined();
      const parsed = engine.parseMap(sandbox.content);
      expect(parsed.map).not.toBeNull();
      const file = recipe?.file.replace(/\.ms$/, ".txt") ?? "";
      expect(readFileSync(join(recipesDir, file), "utf8")).toBe(sandbox.content);
      if (parsed.map && recipe) {
        expect(engine.run(recipe.source, sandbox.content).gold).toBe(
          engine.mapInfo(parsed.map).reachableGold,
        );
      }
    });
  });

  test("a pályafájlok egyeznek a seed térképeivel", () => {
    const mapFiles = filesUnder(join(recipesDir, "palyak"), ".txt");
    expect(mapFiles).toHaveLength(TUTORIAL_MAPS.length);
    mapFiles.forEach((file, index) => {
      expect(readFileSync(join(recipesDir, file), "utf8")).toBe(mapText(index));
    });
  });

  test("minden .ms fájl szerepel a receptlistában, és fordítva", () => {
    const listed = RECIPES.map((recipe) => recipe.file).sort();
    expect(filesUnder(recipesDir, ".ms")).toEqual(listed);
    for (const recipe of RECIPES) {
      expect(readFileSync(join(recipesDir, recipe.file), "utf8")).toBe(recipe.source);
    }
  });

  test("a hibás térképek importja érthető hibával elutasítva", () => {
    const invalidDir = join(recipesDir, "hibas-terkepek");
    expect(readdirSync(invalidDir).sort()).toEqual(Object.keys(INVALID_MAPS).sort());
    for (const [file, code] of Object.entries(INVALID_MAPS) as [string, DiagCode][]) {
      const parsed = engine.parseMap(readFileSync(join(invalidDir, file), "utf8"));
      expect(parsed.map).toBeNull();
      expect(parsed.diagnostics.map((diagnostic) => diagnostic.code)).toContain(code);
    }
  });

  test("a seed minden demó-fiók programtárába beteszi a recepteket", async () => {
    await using context = await createTestContext();
    const report = await seedDemo(context.deps, { reset: false });
    expect(report.recipes).toBe(RECIPES.length * 4);
    const demo = context.client();
    await demo.post("/api/auth/login", { username: "demo1", password: "demo2026" });
    const library = await json<{ programs: { title: string }[] }>(
      await demo.get("/api/programs?pageSize=100"),
    );
    const titles = library.programs.map((program) => program.title);
    for (const recipe of RECIPES) {
      expect(titles).toContain(recipe.title);
    }
  });
});
