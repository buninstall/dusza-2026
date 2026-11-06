import { describe, expect, test } from "bun:test";
import { digitsValue, normalize, spanOf, splitLines } from "../src/source.ts";

const BOM = String.fromCharCode(0xfeff);

describe("normalize", () => {
  test("eldobja a BOM-ot és a CRLF-et LF-re cseréli", () => {
    expect(normalize(`${BOM}a\r\nb\r\n`)).toBe("a\nb\n");
  });

  test("csak a fájl eleji BOM-ot dobja el", () => {
    expect(normalize(`a${BOM}`)).toBe(`a${BOM}`);
  });

  test("a magányos \\r megmarad", () => {
    expect(normalize("a\r\r\nb\r")).toBe("a\r\nb\r");
  });
});

describe("splitLines", () => {
  test("az üres és a csak újsoros fájl nulla sor", () => {
    expect(splitLines("")).toEqual([]);
    expect(splitLines("\n")).toEqual([]);
    expect(splitLines(`${BOM}\r\n`)).toEqual([]);
  });

  test("egy záró újsor nem ad üres sort, a második igen", () => {
    expect(splitLines("a\n").map((line) => line.text)).toEqual(["a"]);
    expect(splitLines("a\n\n").map((line) => line.text)).toEqual(["a", ""]);
  });

  test("a sorszám 1-alapú, az offset a normalizált szövegben számít", () => {
    expect(splitLines("ab\r\ncd")).toEqual([
      { number: 1, text: "ab", offset: 0 },
      { number: 2, text: "cd", offset: 3 },
    ]);
  });
});

describe("spanOf", () => {
  test("1-alapú oszlop és abszolút offset", () => {
    expect(spanOf({ number: 2, text: "print 1", offset: 8 }, 7, 1)).toEqual({
      line: 2,
      colStart: 7,
      colEnd: 8,
      from: 14,
      to: 15,
    });
  });
});

describe("digitsValue", () => {
  test("a vezető nullák nem számítanak", () => {
    expect(digitsValue("007")).toBe(7);
    expect(digitsValue("0100")).toBe(100);
    expect(digitsValue("000")).toBe(0);
  });

  test("a nagyon hosszú szám végtelen, nem veszít pontosságot a határon", () => {
    expect(digitsValue("99999999999999999999")).toBe(Number.POSITIVE_INFINITY);
    expect(digitsValue("000000000101")).toBe(101);
  });
});
