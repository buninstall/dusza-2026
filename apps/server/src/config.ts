import { basename } from "node:path";
import { parseArgs } from "node:util";
import {
  type DatabaseTarget,
  DEFAULT_DATABASE_URL,
  DEFAULT_TEST_DATABASE_URL,
  parseDatabaseUrl,
  parseServerUrl,
  temporaryDatabaseName,
} from "./db/url.ts";

export const DEFAULT_PORT = 8080;
export const PORT_ATTEMPTS = 10;

export type ServerConfig = {
  port: number;
  host: string;
  database: DatabaseTarget;
  openBrowser: boolean;
  resetDemo: boolean;
  serveStatic: boolean;
  compiled: boolean;
  testMode: boolean;
};

export type Environment = Readonly<Record<string, string | undefined>>;

export function isCompiledBinary(): boolean {
  return !/^bun(\.exe)?$/i.test(basename(process.execPath));
}

function firstSet(...values: (string | undefined)[]): string | undefined {
  return values.find((value) => value !== undefined && value !== "");
}

function resolveDatabase(
  flag: string | undefined,
  env: Environment,
  testMode: boolean,
): DatabaseTarget {
  if (testMode) {
    const server = parseServerUrl(
      firstSet(flag, env.TEST_DATABASE_URL, env.DATABASE_URL) ?? DEFAULT_TEST_DATABASE_URL,
    );
    return { ...server, database: temporaryDatabaseName("e2e") };
  }
  return parseDatabaseUrl(firstSet(flag, env.DATABASE_URL) ?? DEFAULT_DATABASE_URL);
}

const OPTIONS = {
  port: { type: "string" },
  host: { type: "string" },
  "database-url": { type: "string" },
  "no-open": { type: "boolean", default: false },
  "reset-demo": { type: "boolean", default: false },
  static: { type: "boolean", default: false },
  "test-mode": { type: "boolean", default: false },
} as const;

const USAGE =
  "Használható kapcsolók: --port <szám>, --host <cím>, --database-url <mysql://…>, " +
  "--no-open, --reset-demo, --static, --test-mode.";

function readArguments(argv: string[]) {
  try {
    return parseArgs({ args: argv, options: OPTIONS, strict: true, allowPositionals: false });
  } catch {
    throw new Error(`Hibás parancssori kapcsoló: ${argv.join(" ")}. ${USAGE}`);
  }
}

export function parseConfig(argv: string[], env: Environment = process.env): ServerConfig {
  const { values } = readArguments(argv);
  const compiled = isCompiledBinary();
  const testMode = values["test-mode"];
  const rawPort = values.port ?? env.PORT ?? `${DEFAULT_PORT}`;
  const port = /^[0-9]{1,5}$/.test(rawPort) ? Number(rawPort) : Number.NaN;
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`Érvénytelen port: ${rawPort}`);
  }
  return {
    port,
    host: values.host ?? env.HOST ?? "127.0.0.1",
    database: resolveDatabase(values["database-url"], env, testMode),
    openBrowser: compiled && !values["no-open"],
    resetDemo: values["reset-demo"] || testMode,
    serveStatic: compiled || values.static || testMode,
    compiled,
    testMode,
  };
}
