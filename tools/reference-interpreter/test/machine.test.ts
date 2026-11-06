import { describe, expect, test } from "bun:test";
import { run } from "../src/index.ts";

const lines = (...text: string[]) => text.join("\n");

describe("run", () => {
  test("hibás térképre magyar hibát dob", () => {
    expect(() => run("", "1 1\nx")).toThrow(
      /A térkép hibás: MAP_NO_ROBOT \(1\. sor\), MAP_BAD_SYMBOL/,
    );
  });

  test("szintaktikai hibánál nincs esemény, csak a kezdőmező felfedezett", () => {
    const result = run("print  1", "1 2\n>.");
    expect(result.outcome.kind).toBe("syntaxError");
    expect(result.events).toEqual([]);
    expect(result.discovered).toEqual([{ row: 0, col: 0 }]);
    expect(result.finalRobot).toEqual({ pos: { row: 0, col: 0 }, dir: "east" });
  });

  test("a robot API teljes eseménysora", () => {
    const result = run(
      lines(
        "set g to isThere 2",
        "step forward 1",
        "turn by 1",
        "set h to isThere 2",
        "step forward 1",
        "mine here",
        "print h",
      ),
      "2 2\n.@\n>.",
    );
    expect(result.outcome).toEqual({ kind: "ok" });
    expect(result.events.map((event) => [event.line, event.steps, event.gold])).toEqual([
      [1, 1, 0],
      [2, 2, 0],
      [3, 3, 0],
      [4, 4, 0],
      [5, 5, 0],
      [6, 6, 1],
      [7, 7, 1],
    ]);
    expect(result.events[0]?.assigned).toEqual({
      name: "g",
      value: { kind: "bool", value: false },
    });
    expect(result.events[0]?.discovered).toEqual([{ row: 1, col: 1 }]);
    expect(result.events[1]?.path).toEqual([{ row: 1, col: 1 }]);
    expect(result.events[1]?.discovered).toEqual([]);
    expect(result.events[3]?.discovered).toEqual([{ row: 0, col: 1 }]);
    expect(result.events[5]?.mined).toEqual({ row: 0, col: 1 });
    expect(result.events[6]?.print).toBe("true");
    expect(result.console).toEqual(["true"]);
    expect(result.finalRobot).toEqual({ pos: { row: 0, col: 1 }, dir: "north" });
    expect(result.discovered).toEqual([
      { row: 1, col: 0 },
      { row: 1, col: 1 },
      { row: 0, col: 1 },
    ]);
  });

  test("bányászás és a futásidejű hiba üzenete", () => {
    const result = run(lines("step forward 1", "mine here", "mine here"), "1 2\n>@");
    expect(result.gold).toBe(1);
    expect(result.events[1]?.mined).toEqual({ row: 0, col: 1 });
    expect(result.outcome).toMatchObject({ kind: "runtimeError", code: "E_NO_GOLD", line: 3 });
    if (result.outcome.kind === "runtimeError") expect(result.outcome.message).toContain("arany");
  });

  test("if-else és while lépésszámlálás", () => {
    const result = run(lines("set i to 0", "while i < 1", "    set i to 1"), "1 1\n>");
    expect(result.outcome.kind).toBe("syntaxError");
    const counted = run(
      lines(
        "set i to 0",
        "set go to true",
        "while go",
        "    set i to i + 1",
        "    set go to i < 2",
        "    if go",
        "        print 1",
        "    else",
        "        print 2",
      ),
      "1 1\n>",
    );
    expect(counted.steps).toBe(14);
    expect(counted.console).toEqual(["1", "2"]);
  });

  test("a limit a while ismételt sorában", () => {
    const result = run(lines("set t to true", "while t"), "1 1\n>");
    expect(result.outcome).toMatchObject({ code: "INSTRUCTION_COUNT_LIMIT_EXCEEDED", line: 2 });
    expect(result.steps).toBe(1000);
    expect(result.events).toHaveLength(1000);
  });

  test("isThere a térképen kívül és belül", () => {
    const result = run(lines("set a to isThere 1", "turn by 2", "set b to isThere 0"), "1 2\n.<");
    expect(result.events.map((event) => event.discovered)).toEqual([[{ row: 0, col: 0 }], [], []]);
    expect(result.events.map((event) => event.assigned?.value.value)).toEqual([
      false,
      undefined,
      false,
    ]);
  });
});
