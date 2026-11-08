import { describe, expect, setDefaultTimeout, test } from "bun:test";
import { DatabaseError, mysqlErrorCode, toDatabaseError } from "../src/db/errors.ts";
import {
  assertDatabaseName,
  DatabaseUrlError,
  describeTarget,
  parseDatabaseUrl,
  parseServerUrl,
  quoteIdentifier,
  temporaryDatabaseName,
  withDatabase,
} from "../src/db/url.ts";
import { TEST_TIMEOUT_MS } from "./timeout.ts";

setDefaultTimeout(TEST_TIMEOUT_MS);

describe("adatbázis-URL", () => {
  test("a teljes URL minden részét kiolvassa", () => {
    expect(parseDatabaseUrl("mysql://dusza:titok@db.example:3307/minescript")).toEqual({
      host: "db.example",
      port: 3307,
      user: "dusza",
      password: "titok",
      database: "minescript",
    });
  });

  test("alapértelmezett port, üres jelszó és százalékos kódolás", () => {
    expect(parseDatabaseUrl("mysql://root@localhost/minescript")).toMatchObject({
      port: 3306,
      password: "",
    });
    expect(parseServerUrl("mysql://b%C3%A1ny%C3%A1sz:p%40ss%3Aw@127.0.0.1")).toMatchObject({
      user: "bányász",
      password: "p@ss:w",
    });
    expect(parseServerUrl("mysql://root@[::1]:3306").host).toBe("::1");
  });

  test("a szerver-URL-ben az adatbázis elhagyható, a teljes URL-ben kötelező", () => {
    expect(parseServerUrl("mysql://root@127.0.0.1:3306")).toEqual({
      host: "127.0.0.1",
      port: 3306,
      user: "root",
      password: "",
    });
    expect(() => parseDatabaseUrl("mysql://root@127.0.0.1:3306")).toThrow(
      "hiányzik az adatbázis neve",
    );
  });

  test("a hibás URL-t magyar üzenettel, a jelszó kiírása nélkül utasítja el", () => {
    for (const raw of ["", "nem url", "postgres://u:titok@h/db", "mysql:///db"]) {
      expect(() => parseServerUrl(raw)).toThrow(DatabaseUrlError);
    }
    expect(() => parseServerUrl("postgres://u:titok@h/db")).toThrow(
      "Az adatbázis-URL nem értelmezhető. A helyes formátum: mysql://felhasználó:jelszó@gép:port/adatbázis",
    );
    expect(() => parseServerUrl("mysql://127.0.0.1/db")).toThrow("hiányzik a felhasználónév");
  });

  test("withDatabase az adatbázis nevét cseréli, a többit megtartja", () => {
    expect(withDatabase("mysql://root:pw@127.0.0.1:3306", "minescript_smoke_1")).toBe(
      "mysql://root:pw@127.0.0.1:3306/minescript_smoke_1",
    );
    expect(withDatabase("mysql://root@h/regi", "uj")).toBe("mysql://root@h/uj");
  });

  test("a leírás nem tartalmazza a jelszót", () => {
    const target = parseDatabaseUrl("mysql://dusza:titok@127.0.0.1:3306/minescript");
    expect(describeTarget(target)).toBe("dusza@127.0.0.1:3306/minescript");
  });
});

describe("adatbázisnév-validálás", () => {
  test("csak betű, számjegy és aláhúzás, legfeljebb 64 karakter", () => {
    expect(assertDatabaseName("minescript_e2e_42")).toBe("minescript_e2e_42");
    expect(assertDatabaseName("a".repeat(64))).toHaveLength(64);
    for (const name of [
      "",
      "a".repeat(65),
      "bad-name",
      "x`; DROP DATABASE y; --",
      "ékezet",
      "a b",
    ]) {
      expect(() => assertDatabaseName(name)).toThrow(DatabaseUrlError);
    }
    expect(() => parseDatabaseUrl("mysql://root@h/rossz%60nev")).toThrow(
      "Érvénytelen adatbázisnév",
    );
  });

  test("az azonosítót backtickek közé teszi, de előbb validálja", () => {
    expect(quoteIdentifier("minescript")).toBe("`minescript`");
    expect(() => quoteIdentifier("mine`script")).toThrow(DatabaseUrlError);
  });

  test("az ideiglenes név a célt, a folyamatot és az időt tartalmazza", () => {
    expect(temporaryDatabaseName("e2e")).toMatch(
      new RegExp(`^minescript_e2e_${process.pid}_\\d+$`),
    );
    expect(temporaryDatabaseName("test", "abc123")).toBe("minescript_test_abc123");
    expect(() => temporaryDatabaseName("e2e", "x".repeat(60))).toThrow(DatabaseUrlError);
  });
});

describe("MySQL-hibák fordítása", () => {
  const target = { host: "127.0.0.1", port: 3306, user: "dusza", password: "", database: "banya" };

  test("a hibakódot a cause-láncból is kiolvassa", () => {
    const wrapped = new Error("Failed query", { cause: { code: "ER_DUP_ENTRY" } });
    expect(mysqlErrorCode(wrapped)).toBe("ER_DUP_ENTRY");
    expect(mysqlErrorCode(new Error("kód nélkül"))).toBeUndefined();
    expect(mysqlErrorCode("szöveg")).toBeUndefined();
  });

  test("hiányzó adatbázis vagy jog: az adatbázist és a felhasználót nevezi meg", () => {
    for (const code of ["ER_BAD_DB_ERROR", "ER_DBACCESS_DENIED_ERROR"]) {
      const error = toDatabaseError(Object.assign(new Error(code), { code }), target);
      expect(error.message).toBe(
        "A „banya” adatbázis nem létezik, vagy a „dusza” felhasználónak nincs hozzá joga.",
      );
      expect(error.hint).toContain("just db-setup");
    }
  });

  test("ismeretlen hibánál az eredeti üzenet, tipp nélkül", () => {
    const original = new Error("valami más");
    const error = toDatabaseError(original, target);
    expect(error.message).toBe("Adatbázishiba (127.0.0.1:3306): valami más");
    expect(error.hint).toBeNull();
    expect(error.cause).toBe(original);
    expect(toDatabaseError("szöveg", target).message).toEndWith("szöveg");
  });

  test("a már lefordított hibát változatlanul adja tovább", () => {
    const translated = new DatabaseError("kész", "tipp");
    expect(toDatabaseError(translated, target)).toBe(translated);
  });
});
