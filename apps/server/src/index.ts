import { createApp } from "./app.ts";
import { createLoginLimiter, LOGIN_LIMIT } from "./auth/rate-limit.ts";
import { DEFAULT_PORT, PORT_ATTEMPTS, parseConfig, type ServerConfig } from "./config.ts";
import { dropDatabase } from "./db/admin.ts";
import { type Database, openDatabase } from "./db/client.ts";
import { DatabaseError } from "./db/errors.ts";
import { migrate } from "./db/migrate.ts";
import { describeTarget } from "./db/url.ts";
import { loadEngine } from "./engine.ts";
import type { Deps } from "./env.ts";
import { behindProxy } from "./lib/request.ts";
import { DEMO_ACCOUNTS, type SeedReport, seedDemo } from "./seed/index.ts";
import { createDesktopReleases } from "./services/desktop.ts";
import { loadStaticHandler } from "./static.ts";

function isAddressInUse(error: unknown): boolean {
  return error instanceof Error && /EADDRINUSE|in use/i.test(`${error.message} ${String(error)}`);
}

function serve(
  config: ServerConfig,
  fetch: (request: Request, server: Bun.Server<undefined>) => Response | Promise<Response>,
) {
  for (let offset = 0; offset <= PORT_ATTEMPTS; offset += 1) {
    const port = config.port + offset;
    try {
      return Bun.serve({ port, hostname: config.host, fetch });
    } catch (error) {
      if (!isAddressInUse(error) || offset === PORT_ATTEMPTS) {
        throw error;
      }
      console.warn(`A(z) ${port} port foglalt, próbálom a következőt…`);
    }
  }
  throw new Error(`Nincs szabad port ${config.port} és ${config.port + PORT_ATTEMPTS} között.`);
}

function openInBrowser(url: string): void {
  const command =
    process.platform === "win32"
      ? ["cmd", "/c", "start", "", url]
      : process.platform === "darwin"
        ? ["open", url]
        : ["xdg-open", url];
  try {
    Bun.spawn(command, { stdout: "ignore", stderr: "ignore" });
  } catch {
    console.warn(`A böngésző nem nyitható meg automatikusan. Nyisd meg kézzel: ${url}`);
  }
}

function printWelcome(url: string, config: ServerConfig): void {
  console.log("");
  console.log("  MineScript – kincskereső robot");
  console.log(`  Az alkalmazás fut: ${url}`);
  console.log(
    `  Adatbázis: ${describeTarget(config.database)}${config.testMode ? " (ideiglenes)" : ""}`,
  );
  console.log("");
  console.log("  Demó belépési adatok:");
  for (const account of DEMO_ACCOUNTS) {
    const role = account.role === "admin" ? "adminisztrátor" : "játékos";
    console.log(`    ${account.username.padEnd(6)} / ${account.password}  (${role})`);
  }
  console.log("");
  console.log("  Leállítás: Ctrl+C");
}

function printSeedReport(report: SeedReport): void {
  if (!report.seeded) {
    return;
  }
  const skipped =
    report.skippedRuns > 0 ? ` (${report.skippedRuns} futás kihagyva: a motor még nem futtat)` : "";
  console.log(
    `Demó-adatok létrehozva: ${report.users} felhasználó, ${report.maps} térkép, ${report.runs} futás, ${report.recipes} recept a programtárakban${skipped}`,
  );
}

function describeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return error instanceof DatabaseError && error.hint ? `${message}\n${error.hint}` : message;
}

async function start(config: ServerConfig, database: Database) {
  await migrate(config.database);
  const deps: Deps = {
    db: database.db,
    engine: await loadEngine(),
    limiter: createLoginLimiter({ ...LOGIN_LIMIT, now: Date.now }),
    now: Date.now,
    desktop: config.desktop ? createDesktopReleases(config.desktop) : undefined,
  };
  printSeedReport(await seedDemo(deps, { reset: config.resetDemo }));
  const app = createApp(
    deps,
    config.serveStatic ? { staticHandler: await loadStaticHandler() } : {},
  );
  return serve(config, (request, bunServer) =>
    app.fetch(request, config.trustProxy ? behindProxy(bunServer) : bunServer),
  );
}

async function main(): Promise<void> {
  const config = parseConfig(Bun.argv.slice(2));
  const database = await openDatabase(config.database);
  const release = async () => {
    await database.close();
    if (config.testMode) {
      await dropDatabase(config.database);
    }
  };
  const server = await start(config, database).catch(async (error: unknown) => {
    await release();
    throw error;
  });
  const url = `http://${config.host === "0.0.0.0" ? "127.0.0.1" : config.host}:${server.port ?? DEFAULT_PORT}`;
  printWelcome(url, config);
  if (config.openBrowser) {
    openInBrowser(url);
  }
  let stopping = false;
  const shutdown = async () => {
    if (stopping) {
      return;
    }
    stopping = true;
    await server.stop();
    await release().catch((error: unknown) => {
      console.error(`Leállítási hiba: ${describeError(error)}`);
      process.exitCode = 1;
    });
    process.exit();
  };
  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());
}

main().catch((error: unknown) => {
  console.error(`A szerver nem indult el: ${describeError(error)}`);
  process.exit(1);
});
