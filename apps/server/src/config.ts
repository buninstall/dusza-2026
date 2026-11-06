import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { parseArgs } from "node:util";

export const DEFAULT_PORT = 8080;
export const PORT_ATTEMPTS = 10;

export type ServerConfig = {
  port: number;
  host: string;
  dbPath: string;
  openBrowser: boolean;
  resetDemo: boolean;
  serveStatic: boolean;
  compiled: boolean;
  testMode: boolean;
};

export function isCompiledBinary(): boolean {
  return !/^bun(\.exe)?$/i.test(basename(process.execPath));
}

function defaultDbPath(compiled: boolean, testMode: boolean): string {
  if (testMode) {
    return join(tmpdir(), `minescript-test-${process.pid}-${Date.now()}.db`);
  }
  if (compiled) {
    return join(dirname(process.execPath), "minescript.db");
  }
  const dataDir = join(import.meta.dir, "..", "data");
  mkdirSync(dataDir, { recursive: true });
  return join(dataDir, "minescript.db");
}

export function parseConfig(argv: string[]): ServerConfig {
  const { values } = parseArgs({
    args: argv,
    options: {
      port: { type: "string" },
      host: { type: "string" },
      db: { type: "string" },
      "no-open": { type: "boolean", default: false },
      "reset-demo": { type: "boolean", default: false },
      static: { type: "boolean", default: false },
      "test-mode": { type: "boolean", default: false },
    },
    strict: true,
    allowPositionals: false,
  });
  const compiled = isCompiledBinary();
  const testMode = values["test-mode"];
  const port = Number.parseInt(values.port ?? process.env.PORT ?? `${DEFAULT_PORT}`, 10);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`Érvénytelen port: ${values.port ?? process.env.PORT}`);
  }
  return {
    port,
    host: values.host ?? process.env.HOST ?? "127.0.0.1",
    dbPath: values.db ?? defaultDbPath(compiled, testMode),
    openBrowser: compiled && !values["no-open"],
    resetDemo: values["reset-demo"] || testMode,
    serveStatic: compiled || values.static || testMode,
    compiled,
    testMode,
  };
}
