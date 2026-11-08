import { describe, expect, setDefaultTimeout, test } from "bun:test";
import { DEFAULT_PORT, parseConfig } from "../src/config.ts";
import { DatabaseUrlError } from "../src/db/url.ts";
import { TEST_TIMEOUT_MS } from "./timeout.ts";

setDefaultTimeout(TEST_TIMEOUT_MS);

const NO_ENV = {};

describe("konfiguráció", () => {
  test("alapértelmezések: helyi MySQL fejlesztői fiókkal", () => {
    const config = parseConfig([], NO_ENV);
    expect(config).toMatchObject({
      port: DEFAULT_PORT,
      host: "127.0.0.1",
      resetDemo: false,
      testMode: false,
      compiled: false,
      openBrowser: false,
      serveStatic: false,
    });
    expect(config.database).toEqual({
      host: "127.0.0.1",
      port: 3306,
      user: "minescript",
      password: "minescript",
      database: "minescript",
    });
  });

  test("a DATABASE_URL környezeti változót használja", () => {
    const config = parseConfig([], { DATABASE_URL: "mysql://app:pw@db:3307/verseny" });
    expect(config.database).toEqual({
      host: "db",
      port: 3307,
      user: "app",
      password: "pw",
      database: "verseny",
    });
  });

  test("a --database-url kapcsoló erősebb a környezeti változónál", () => {
    const config = parseConfig(["--database-url", "mysql://cli@127.0.0.1/kapcsolo"], {
      DATABASE_URL: "mysql://env@127.0.0.1/kornyezet",
    });
    expect(config.database).toMatchObject({ user: "cli", database: "kapcsolo" });
  });

  test("az üres DATABASE_URL nem számít beállításnak", () => {
    expect(parseConfig([], { DATABASE_URL: "" }).database.database).toBe("minescript");
  });

  test("port, host és kapcsolók", () => {
    const argv = ["--port", "9000", "--host", "0.0.0.0", "--reset-demo", "--static"];
    const config = parseConfig(argv, { PORT: "7000" });
    expect(config).toMatchObject({
      port: 9000,
      host: "0.0.0.0",
      resetDemo: true,
      serveStatic: true,
    });
    expect(parseConfig([], { PORT: "7000", HOST: "::1" })).toMatchObject({
      port: 7000,
      host: "::1",
    });
  });

  test("proxy mögött a --trust-proxy vagy a TRUST_PROXY kapcsolja be a továbbított címet", () => {
    expect(parseConfig([], NO_ENV).trustProxy).toBe(false);
    expect(parseConfig(["--trust-proxy"], NO_ENV).trustProxy).toBe(true);
    expect(parseConfig([], { TRUST_PROXY: "1" }).trustProxy).toBe(true);
    expect(parseConfig([], { TRUST_PROXY: " True " }).trustProxy).toBe(true);
    expect(parseConfig([], { TRUST_PROXY: "0" }).trustProxy).toBe(false);
    expect(parseConfig([], { TRUST_PROXY: "" }).trustProxy).toBe(false);
  });

  test("teszt módban friss, ideiglenes adatbázis a teszt-szerveren", () => {
    const config = parseConfig(["--test-mode"], {
      DATABASE_URL: "mysql://minescript:minescript@127.0.0.1:3306/minescript",
      TEST_DATABASE_URL: "mysql://root:gyoker@127.0.0.1:3307",
    });
    expect(config).toMatchObject({ testMode: true, resetDemo: true, serveStatic: true });
    expect(config.database).toMatchObject({ user: "root", password: "gyoker", port: 3307 });
    expect(config.database.database).toMatch(new RegExp(`^minescript_e2e_${process.pid}_\\d+$`));
  });

  test("teszt módban TEST_DATABASE_URL nélkül a DATABASE_URL szerverét, végül a helyi root-ot használja", () => {
    const fromDatabaseUrl = parseConfig(["--test-mode"], {
      DATABASE_URL: "mysql://admin:pw@db:3306/minescript",
    });
    expect(fromDatabaseUrl.database).toMatchObject({ user: "admin", host: "db" });
    expect(fromDatabaseUrl.database.database).not.toBe("minescript");
    const fallback = parseConfig(["--test-mode"], NO_ENV);
    expect(fallback.database).toMatchObject({ user: "root", password: "", host: "127.0.0.1" });
  });

  test("hibás port, URL és ismeretlen kapcsoló", () => {
    expect(() => parseConfig(["--port", "0"], NO_ENV)).toThrow("Érvénytelen port: 0");
    expect(() => parseConfig([], { PORT: "sok" })).toThrow("Érvénytelen port: sok");
    expect(() => parseConfig(["--database-url", "file:///tmp/adatok"], NO_ENV)).toThrow(
      DatabaseUrlError,
    );
    expect(() => parseConfig(["--db", "x"], NO_ENV)).toThrow();
  });
});
