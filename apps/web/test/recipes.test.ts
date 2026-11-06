import { describe, expect, test } from "vitest";
import {
  BAD_MAPS,
  CORRIDOR_FILE,
  ERROR_RECIPES,
  findRecipe,
  MAP_RECIPES,
  normaliseMap,
  recipeText,
} from "../src/recipes/catalog.ts";
import { realEngine } from "./support/engine.ts";

describe("receptek", () => {
  test.each(MAP_RECIPES)("$file: $gold / $total arany, $steps lépés", (recipe) => {
    const map = recipeText(recipe.mapFile);
    const parsed = realEngine.parseMap(map);
    expect(parsed.map).not.toBeNull();
    const result = realEngine.run(recipeText(recipe.file), map);
    expect(result.outcome.kind).toBe("ok");
    expect(result.gold).toBe(recipe.gold);
    expect(result.steps).toBe(recipe.steps);
    expect(parsed.map ? realEngine.mapInfo(parsed.map).goldTotal : 0).toBe(recipe.total);
  });

  test.each(ERROR_RECIPES)("$file: $code a(z) $lines. sorban", (recipe) => {
    const result = realEngine.run(recipeText(recipe.file), recipeText(CORRIDOR_FILE));
    const { outcome } = result;
    if (recipe.code === null) {
      expect(outcome.kind).toBe("syntaxError");
      if (outcome.kind === "syntaxError") {
        expect([...new Set(outcome.diagnostics.map((item) => item.span.line))]).toEqual(
          recipe.lines,
        );
      }
      return;
    }
    expect(outcome).toMatchObject({
      kind: "runtimeError",
      code: recipe.code,
      line: recipe.lines[0],
    });
    expect(result.steps).toBe(recipe.steps);
  });

  test.each(BAD_MAPS)("$file: $code", (bad) => {
    const parsed = realEngine.parseMap(recipeText(bad.file));
    expect(parsed.map).toBeNull();
    expect(parsed.diagnostics.map((item) => item.code)).toContain(bad.code);
  });

  test("a pályák kanonikus alakban vannak, a receptek névvel kereshetők", () => {
    for (const recipe of MAP_RECIPES) {
      const map = recipeText(recipe.mapFile);
      const parsed = realEngine.parseMap(map);
      expect(parsed.map && normaliseMap(realEngine.serializeMap(parsed.map))).toBe(
        normaliseMap(map),
      );
    }
    expect(findRecipe("03-kis-labirintus")?.title).toBe("3. Kis labirintus");
    expect(findRecipe("e-no-gold")?.mapFile).toBe(CORRIDOR_FILE);
    expect(findRecipe("nincs-ilyen")).toBeUndefined();
    expect(() => recipeText("nincs.ms")).toThrow();
  });
});
