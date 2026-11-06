import { describe, expect, test } from "vitest";
import { hu } from "../src/i18n/hu.ts";

type Builder = (...args: unknown[]) => unknown;

function builders(value: unknown, path: string): [string, Builder][] {
  if (typeof value === "function") {
    return [[path, value as Builder]];
  }
  if (value !== null && typeof value === "object") {
    return Object.entries(value).flatMap(([key, child]) => builders(child, `${path}.${key}`));
  }
  return [];
}

function attempt(builder: Builder, sample: unknown): unknown {
  try {
    return builder(...Array.from({ length: Math.max(builder.length, 1) }, () => sample));
  } catch (error) {
    return error;
  }
}

function render(builder: Builder): unknown {
  const samples: unknown[] = [3, "Kis labirintus", [3, 4]];
  return samples.map((sample) => attempt(builder, sample)).find((text) => typeof text === "string");
}

describe("magyar szövegek", () => {
  test.each(builders(hu, "hu"))("%s kész magyar mondatot ad", (_, builder) => {
    const text = render(builder);
    expect(typeof text).toBe("string");
    expect(String(text).trim().length).toBeGreaterThan(0);
    expect(String(text)).not.toMatch(/undefined|NaN|\[object/);
  });
});
