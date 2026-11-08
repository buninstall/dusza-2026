import { describe, expect, test, vi } from "vitest";
import {
  decodeUtf8,
  downloadText,
  firstFile,
  normalizeNewlines,
  safeFilename,
} from "../src/lib/files.ts";
import {
  clampSize,
  draftFromMap,
  draftGrid,
  draftRobot,
  draftToText,
  emptyDraft,
  MAX_SIZE,
  paint,
  resizeDraft,
  toolForKey,
  turnRobot,
} from "../src/map-editor/editor-state.ts";
import { MAP_FILE_MAX_CHARS, parseMapFile } from "../src/map-editor/map-file.ts";
import { decodeProgramFile, PROGRAM_MAX_CHARS } from "../src/play/program-file.ts";
import { realEngine } from "./support/engine.ts";

const encode = (text: string) => new TextEncoder().encode(text).buffer as ArrayBuffer;

describe("térképszerkesztő állapot", () => {
  test("az üres vázlat érvényes szöveget ad, a méret 1 és 15 közé szorul", () => {
    expect(draftToText(emptyDraft(1, 3))).toBe("1 3\n>..\n");
    expect(emptyDraft(0, 99).cols).toBe(MAX_SIZE);
    expect(clampSize(Number.NaN)).toBe(1);
    expect(clampSize(7.8)).toBe(7);
  });

  test("a robot lerakása kitörli az aranyat, és felveszi az irányt", () => {
    let draft = paint(emptyDraft(1, 3), { row: 0, col: 2 }, "gold", "east");
    draft = paint(draft, { row: 0, col: 2 }, "robot", "west");
    expect(draftToText(draft)).toBe("1 3\n..<\n");
    expect(draftRobot(draft)).toEqual({ pos: { row: 0, col: 2 }, dir: "west" });
  });

  test("fal és arany nem festi felül a robotot, a törlés eltávolítja, a rácson kívül nincs hatás", () => {
    const start = emptyDraft(1, 2);
    expect(paint(start, { row: 0, col: 0 }, "wall", "east")).toBe(start);
    expect(paint(start, { row: 0, col: 0 }, "gold", "east")).toBe(start);
    const draft = paint(
      paint(start, { row: 0, col: 1 }, "wall", "east"),
      { row: 0, col: 0 },
      "empty",
      "east",
    );
    expect(draft.robot).toBeNull();
    expect(draftRobot(draft)).toBeNull();
    expect(draftToText(draft)).toBe("1 2\n.#\n");
    expect(draftGrid(draft).robot).toEqual({ row: 0, col: 0 });
    expect(paint(draft, { row: 5, col: 5 }, "gold", "east")).toBe(draft);
  });

  test("átméretezéskor a kívül eső robot elvész, a többi mező megmarad", () => {
    const moved = paint(emptyDraft(3, 3), { row: 2, col: 2 }, "robot", "south");
    const shrunk = resizeDraft(moved, 2, 40);
    expect([shrunk.rows, shrunk.cols, shrunk.robot]).toEqual([2, 15, null]);
    const grown = resizeDraft(paint(emptyDraft(1, 1), { row: 0, col: 0 }, "robot", "north"), 2, 2);
    expect(draftToText(grown)).toBe("2 2\n^.\n..\n");
  });

  test("a gyorsbillentyűk és a forgatás", () => {
    expect(toolForKey("1")).toBe("empty");
    expect(toolForKey("4")).toBe("robot");
    expect(toolForKey("5")).toBeNull();
    expect(toolForKey("x")).toBeNull();
    expect(turnRobot(emptyDraft(1, 1), "north").dir).toBe("north");
  });

  test("a térképből készült vázlat független másolat", () => {
    const parsed = realEngine.parseMap("1 3\n.@^\n").map;
    expect(parsed).not.toBeNull();
    if (parsed) {
      const draft = draftFromMap(parsed);
      draft.cells[0]?.splice(0, 1, "wall");
      expect(parsed.cells[0]?.[0]).toBe("empty");
      expect(draft.dir).toBe("north");
    }
  });
});

describe("fájlok", () => {
  test("UTF-8 dekódolás BOM nélkül, hibás bájtokra hibával", () => {
    expect(decodeUtf8(encode("﻿hello"))).toEqual({ ok: true, text: "hello" });
    expect(decodeUtf8(new Uint8Array([0xff, 0xfe, 0xfd]).buffer)).toEqual({
      ok: false,
      reason: "encoding",
    });
    expect(normalizeNewlines("a\r\nb\n")).toBe("a\nb\n");
  });

  test("biztonságos fájlnév ékezet és írásjel nélkül", () => {
    expect(safeFilename("3. Kis labirintus!")).toBe("3-Kis-labirintus");
    expect(safeFilename("Árvíztűrő")).toBe("Arvizturo");
    expect(safeFilename("???")).toBe("minescript");
  });

  test("a letöltés ideiglenes linkkel történik", () => {
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);
    URL.createObjectURL = vi.fn(() => "blob:minescript");
    URL.revokeObjectURL = vi.fn();
    downloadText("terkep.txt", "1 1\n>\n");
    expect(click).toHaveBeenCalledOnce();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:minescript");
    expect(document.querySelector("a[download]")).toBeNull();
    click.mockRestore();
  });

  test("a FileList első eleme", () => {
    expect(firstFile(null)).toBeNull();
  });
});

describe("programfájl importja (D23)", () => {
  test("a szintaktikailag hibás, de szöveges program betölthető", () => {
    expect(decodeProgramFile(encode("step  forward 1\r\n"))).toEqual({
      ok: true,
      text: "step  forward 1\n",
      raw: "step  forward 1\r\n",
    });
  });

  test("nem UTF-8, NUL karakteres vagy túl hosszú fájl nem töltődik be", () => {
    const invalid = decodeProgramFile(new Uint8Array([0xc3, 0x28]).buffer);
    expect(invalid).toEqual({ ok: false, message: expect.stringMatching(/UTF-8/) });
    expect(decodeProgramFile(encode("print 1\u0000"))).toEqual({
      ok: false,
      message: expect.stringMatching(/NUL/),
    });
    const long = decodeProgramFile(encode("a".repeat(PROGRAM_MAX_CHARS + 1)));
    expect(long).toEqual({ ok: false, message: expect.stringMatching(/100\s000/) });
  });
});

describe("térképfájl importja", () => {
  test("érvényes fájl betöltődik", () => {
    const result = parseMapFile(realEngine, encode("1 3\n>.@\n"));
    expect(result.ok).toBe(true);
  });

  test("hibás térkép a diagnosztikákkal együtt utasítódik el", () => {
    const result = parseMapFile(realEngine, encode("2 3\n>.@\n#.\n"));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toMatch(/nem érvényes térkép/);
      expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain("MAP_ROW_LENGTH");
    }
  });

  test("nem szöveges vagy túl nagy fájl", () => {
    expect(parseMapFile(realEngine, new Uint8Array([0xff]).buffer)).toMatchObject({ ok: false });
    const huge = parseMapFile(realEngine, encode(".".repeat(MAP_FILE_MAX_CHARS + 1)));
    expect(huge).toMatchObject({ ok: false, message: expect.stringMatching(/túl nagy/) });
  });
});
