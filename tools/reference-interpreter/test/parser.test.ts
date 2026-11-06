import { describe, expect, test } from "bun:test";
import type { Stmt } from "@minescript/engine";
import { check, parse } from "../src/parser.ts";

const lines = (...text: string[]) => text.join("\n");
const codes = (src: string) => check(src).diagnostics.map((d) => `${d.line}:${d.col}:${d.code}`);

function shape(body: Stmt[]): unknown[] {
  return body.map((stmt) => {
    const kind = stmt.kind;
    if (kind.kind === "if") {
      return {
        if: stmt.line,
        thenBody: shape(kind.thenBody),
        else: kind.elseBranch
          ? { line: kind.elseBranch.line, body: shape(kind.elseBranch.body) }
          : null,
      };
    }
    if (kind.kind === "while") return { while: stmt.line, body: shape(kind.body) };
    return `${stmt.line}:${kind.kind}`;
  });
}

describe("check", () => {
  test("az érvényes program hibátlan", () => {
    expect(check(lines("set a to 1", "print a"))).toEqual({ valid: true, diagnostics: [] });
  });

  test("minden nyelvtani hibafajta", () => {
    expect(codes("step forward")).toEqual(["1:13:SYN_MISSING_TOKEN"]);
    expect(codes("step back 1")).toEqual(["1:6:SYN_UNEXPECTED_TOKEN"]);
    expect(codes("turn by 1 2")).toEqual(["1:11:SYN_EXTRA_TOKEN"]);
    expect(codes("mine there")).toEqual(["1:6:SYN_UNEXPECTED_TOKEN"]);
    expect(codes("print while")).toEqual(["1:7:SYN_UNEXPECTED_TOKEN"]);
    expect(codes("print While")).toEqual(["1:7:SYN_RESERVED_IDENT"]);
    expect(codes("set 5 to 1")).toEqual(["1:5:SYN_UNEXPECTED_TOKEN"]);
    expect(codes("set Set to 1")).toEqual(["1:5:SYN_RESERVED_IDENT"]);
    expect(codes("set x to 1 2")).toEqual(["1:12:SYN_UNEXPECTED_TOKEN"]);
    expect(codes("set x to 1 + 2 + 3")).toEqual(["1:16:SYN_EXTRA_TOKEN"]);
    expect(codes("set x to isThere 2 3")).toEqual(["1:20:SYN_EXTRA_TOKEN"]);
    expect(codes("set x to not")).toEqual(["1:13:SYN_MISSING_TOKEN"]);
    expect(codes("Step forward 1")).toEqual(["1:1:SYN_UNKNOWN_COMMAND"]);
    expect(codes("while true true")).toEqual(["1:12:SYN_EXTRA_TOKEN"]);
  });

  test("a token-osztályhiba azonos oszlopon megelőzi a nyelvtani hibát", () => {
    expect(codes("árany to 1")).toEqual(["1:1:SYN_INVALID_IDENT"]);
    expect(codes("set a_b to 1")).toEqual(["1:5:SYN_INVALID_IDENT"]);
    expect(codes("step 101")).toEqual(["1:6:SYN_NUMBER_RANGE"]);
  });

  test("a sor első tokenszintű hibája oszlop szerint", () => {
    expect(codes("print  1 2")).toEqual(["1:7:SYN_DOUBLE_SPACE"]);
    expect(codes("print 1 2 ")).toEqual(["1:9:SYN_EXTRA_TOKEN"]);
    expect(codes("print ")).toEqual(["1:6:SYN_TRAILING_SPACE"]);
  });

  test("behúzás: legfelső szint, váratlan, egyenetlen, visszahúzás", () => {
    expect(codes("  print 1")).toEqual(["1:1:SYN_TOPLEVEL_INDENT"]);
    expect(codes(lines("print 1", "  print 2"))).toEqual(["2:1:SYN_UNEXPECTED_INDENT"]);
    expect(codes(lines("while true", "  print 1", "   print 2"))).toEqual([
      "3:1:SYN_INCONSISTENT_INDENT",
    ]);
    expect(codes(lines("while true", "    print 1", "  print 2"))).toEqual([
      "3:1:SYN_DEDENT_MISMATCH",
    ]);
  });

  test("else: árva, dupla, és hibás else is fejléc", () => {
    expect(codes(lines("else", "    print 1"))).toEqual(["1:1:SYN_ELSE_WITHOUT_IF"]);
    expect(codes(lines("if true", "else", "else"))).toEqual(["3:1:SYN_ELSE_WITHOUT_IF"]);
    expect(codes(lines("if true", "  else"))).toEqual(["2:3:SYN_ELSE_WITHOUT_IF"]);
  });

  test("minden sor hibája, sor és oszlop szerint rendezve", () => {
    expect(codes(lines("else x", "print  1", "  print 101"))).toEqual([
      "1:1:SYN_ELSE_WITHOUT_IF",
      "1:6:SYN_EXTRA_TOKEN",
      "2:7:SYN_DOUBLE_SPACE",
      "3:1:SYN_UNEXPECTED_INDENT",
      "3:9:SYN_NUMBER_RANGE",
    ]);
  });

  test("a szkennerhibás sor kimarad a behúzás-elemzésből", () => {
    expect(codes(lines("if true", "\tprint 1", "    print 2"))).toEqual(["2:1:SYN_TAB"]);
  });
});

describe("parse", () => {
  test("hiba esetén nincs program", () => {
    expect(parse("print  1").program).toBeNull();
  });

  test("a súgó a kis-/nagybetűtől független utasítást javasolja", () => {
    expect(parse("WHILE true").diagnostics[0]?.help).toContain("while");
    expect(parse("arany").diagnostics[0]?.help).toBeNull();
  });

  test("az if-else és a while blokkszerkezete", () => {
    const program = parse(
      lines(
        "while a",
        "  if b",
        "      print 1",
        "  else",
        "   if c",
        "   step forward 1",
        "mine here",
        "if d",
        "else",
      ),
    ).program;
    expect(shape(program?.body ?? [])).toEqual([
      {
        while: 1,
        body: [
          {
            if: 2,
            thenBody: ["3:print"],
            else: { line: 4, body: [{ if: 5, thenBody: [], else: null }, "6:step"] },
          },
        ],
      },
      "7:mine",
      { if: 8, thenBody: [], else: { line: 9, body: [] } },
    ]);
  });

  test("a kifejezések alakjai", () => {
    const program = parse(
      lines(
        "set a to isThere 2",
        "set b to not a",
        "set c to 1 <= x",
        "set d to false",
        "turn by 007",
      ),
    ).program;
    const values = program?.body.map((stmt) =>
      stmt.kind.kind === "set" ? stmt.kind.value.kind : stmt.kind.kind,
    );
    expect(values).toEqual(["isThere", "not", "binary", "simple", "turn"]);
    const turn = program?.body[4]?.kind;
    expect(turn?.kind === "turn" ? turn.quarters : null).toMatchObject({ kind: "int", value: 7 });
  });
});
