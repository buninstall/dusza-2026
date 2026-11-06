import { createApp } from "./app.ts";
import { createLoginLimiter, LOGIN_LIMIT } from "./auth/rate-limit.ts";
import { DEFAULT_PORT, PORT_ATTEMPTS, parseConfig, type ServerConfig } from "./config.ts";
import { openDatabase } from "./db/client.ts";
import { migrate } from "./db/migrate.ts";
import { loadEngine } from "./engine.ts";
import type { Deps } from "./env.ts";
import { DEMO_ACCOUNTS, seedDemo } from "./seed/index.ts";
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
  console.log(`  Adatbázis: ${config.dbPath}`);
  console.log("");
  console.log("  Demó belépési adatok:");
  for (const account of DEMO_ACCOUNTS) {
    const role = account.role === "admin" ? "adminisztrátor" : "játékos";
    console.log(`    ${account.username.padEnd(6)} / ${account.password}  (${role})`);
  }
  console.log("");
  console.log("  Leállítás: Ctrl+C");
}

async function main(): Promise<void> {
  const config = parseConfig(Bun.argv.slice(2));
  const { sqlite, db } = openDatabase(config.dbPath);
  migrate(sqlite);
  const engine = await loadEngine();
  const deps: Deps = {
    db,
    engine,
    limiter: createLoginLimiter({ ...LOGIN_LIMIT, now: Date.now }),
    now: Date.now,
  };
  const report = await seedDemo(deps, { reset: config.resetDemo });
  if (report.seeded) {
    console.log(
      `Demó-adatok létrehozva: ${report.users} felhasználó, ${report.maps} térkép, ${report.runs} futás` +
        (report.skippedRuns > 0
          ? ` (${report.skippedRuns} futás kihagyva: a motor még nem futtat)`
          : ""),
    );
  }
  const app = createApp(
    deps,
    config.serveStatic ? { staticHandler: await loadStaticHandler() } : {},
  );
  const server = serve(config, (request, bunServer) => app.fetch(request, bunServer));
  const url = `http://${config.host === "0.0.0.0" ? "127.0.0.1" : config.host}:${server.port ?? DEFAULT_PORT}`;
  printWelcome(url, config);
  if (config.openBrowser) {
    openInBrowser(url);
  }
  const shutdown = () => {
    server.stop();
    sqlite.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error: unknown) => {
  console.error("A szerver nem indult el:", error instanceof Error ? error.message : error);
  process.exit(1);
});
