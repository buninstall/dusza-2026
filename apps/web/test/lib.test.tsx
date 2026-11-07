import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderHook } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { diagnosticTitles, formatCount, formatTime, hu, runtimeErrors } from "../src/i18n/hu.ts";
import { ApiError, call, errorMessage } from "../src/lib/api.ts";
import { initialCursor } from "../src/lib/cursor.ts";
import { usePrefersReducedMotion } from "../src/lib/motion.ts";
import { createQueryClient } from "../src/lib/query.ts";
import { readStorage, writeStorage } from "../src/lib/storage.ts";
import { applyTheme } from "../src/lib/theme.ts";

const generated = join(
  import.meta.dirname,
  "..",
  "..",
  "..",
  "packages",
  "engine",
  "src",
  "generated",
);

function literals(file: string): string[] {
  const source = readFileSync(join(generated, file), "utf8");
  return [...source.matchAll(/"([A-Z0-9_]+)"/g)].map((match) => match[1] ?? "").sort();
}

describe("i18n teljesség", () => {
  test("minden RuntimeErrorCode-hoz van magyar cím és tipp", () => {
    const codes = literals("RuntimeErrorCode.ts");
    expect(codes.length).toBeGreaterThan(0);
    expect(Object.keys(runtimeErrors).sort()).toEqual(codes);
    for (const text of Object.values(runtimeErrors)) {
      expect(text.title.length).toBeGreaterThan(0);
      expect(text.hint.length).toBeGreaterThan(0);
    }
  });

  test("minden DiagCode-hoz van magyar cím", () => {
    expect(Object.keys(diagnosticTitles).sort()).toEqual(literals("DiagCode.ts"));
  });

  test("a kézikönyv fejezetei egyedi horgonyt kapnak", () => {
    const ids = hu.manual.sections.map((section) => section.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(hu.manual.sections.every((section) => section.blocks.length > 0)).toBe(true);
    expect(hu.manual.parts.flatMap((part) => part.ids)).toEqual(ids);
  });

  test("formázók", () => {
    expect(formatCount(100_000)).toMatch(/100\s000/);
    expect(formatTime(0)).toMatch(/1970/);
    expect(hu.play.syntaxErrorLines([2])).toBe("Hibás sor: 2.");
    expect(hu.play.syntaxErrorLines([2, 5])).toBe("Hibás sorok: 2, 5.");
    expect(hu.maps.gold(2, 3)).toBe("2 / 3");
    expect(hu.signs.level(3)).toBe("Szint 03");
  });
});

describe("API-hívás", () => {
  test("sikeres válasz törzse", async () => {
    const response = new Response(JSON.stringify({ ok: true }), { status: 200 });
    await expect(call(Promise.resolve(response))).resolves.toEqual({ ok: true });
  });

  test("hibás válasz egységes ApiError-rá alakul", async () => {
    const response = new Response(
      JSON.stringify({ error: { code: "MAP_INVALID", message: "Rossz térkép.", details: [1] } }),
      { status: 422 },
    );
    const error = await call(Promise.resolve(response)).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 422, code: "MAP_INVALID", details: [1] });
    expect(errorMessage(error, "x")).toBe("Rossz térkép.");
    expect(errorMessage(new Error("belső"), "tartalék")).toBe("tartalék");
    const validation = new ApiError(400, "VALIDATION", "A kérés adatai hibásak.", [
      { path: "title", message: "A cím nem lehet üres." },
      { path: "title", message: "A cím nem lehet üres." },
      { path: "content", message: "A térkép túl hosszú." },
      { path: "x" },
    ]);
    expect(errorMessage(validation, "x")).toBe(
      "A kérés adatai hibásak. A cím nem lehet üres. A térkép túl hosszú.",
    );
    expect(errorMessage(new ApiError(400, "VALIDATION", "Hiba.", "nem lista"), "x")).toBe("Hiba.");
  });

  test("nem JSON hibaválasz és hálózati hiba", async () => {
    const broken = await call(Promise.resolve(new Response("<html>", { status: 500 }))).catch(
      (caught: unknown) => caught,
    );
    expect(broken).toMatchObject({ code: "HTTP_ERROR", status: 500 });
    const network = await call(Promise.reject(new TypeError("offline"))).catch(
      (caught: unknown) => caught,
    );
    expect(network).toMatchObject({ code: "NETWORK", status: 0 });
  });

  test("a lekérdezés nem próbálja újra a 4xx-et és a már újrapróbált szerverhibát", () => {
    const client = createQueryClient();
    const retry = client.getDefaultOptions().queries?.retry;
    expect(typeof retry).toBe("function");
    if (typeof retry === "function") {
      expect(retry(0, new ApiError(404, "NOT_FOUND", "x"))).toBe(false);
      expect(retry(0, new ApiError(500, "INTERNAL", "x"))).toBe(false);
      expect(retry(0, new ApiError(0, "NETWORK", "x"))).toBe(false);
      expect(retry(0, new Error("x"))).toBe(true);
      expect(retry(5, new Error("x"))).toBe(false);
    }
  });

  test("a 401 a kilépett állapot kezelőjét hívja", async () => {
    let calls = 0;
    const client = createQueryClient(() => {
      calls += 1;
    });
    await client
      .fetchQuery({
        queryKey: ["probe"],
        queryFn: () => Promise.reject(new ApiError(401, "UNAUTHORIZED", "x")),
      })
      .catch(() => null);
    expect(calls).toBe(1);
  });
});

describe("téma és tárolás", () => {
  test("mindig a sötét Tárna téma él, a theme-color metával együtt", () => {
    const meta = document.createElement("meta");
    meta.name = "theme-color";
    document.head.append(meta);
    applyTheme();
    expect(document.documentElement.dataset.theme).toBe("tarna");
    expect(meta.getAttribute("content")).toBe("#110f0d");
    meta.remove();
  });

  test("a csákány egérmutató az alapértelmezett, a rendes mutató választható", () => {
    expect(initialCursor()).toBe("pickaxe");
    writeStorage("minescript.cursor", "system");
    expect(initialCursor()).toBe("system");
    writeStorage("minescript.cursor", "pickaxe");
  });

  test("a tárolás hibája nem dob kivételt", () => {
    const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("tiltva");
    });
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("tiltva");
    });
    expect(readStorage("x")).toBeNull();
    expect(() => writeStorage("x", "y")).not.toThrow();
    getItem.mockRestore();
    setItem.mockRestore();
  });

  test("a csökkentett mozgás beállítás követése", () => {
    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(typeof result.current).toBe("boolean");
  });
});
