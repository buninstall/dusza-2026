import { join } from "node:path";
import {
  capture,
  fail,
  info,
  lockedCrateVersion,
  paths,
  root,
  run,
  runOrFail,
  warn,
  which,
} from "./lib.ts";

const flags = new Set(Bun.argv.slice(2));
const withE2e = flags.has("--with-e2e");
const withWasmOpt = flags.has("--with-wasm-opt");

function requireTool(name: string, hint: string): void {
  if (!which(name)) {
    fail(`Hiányzó eszköz: ${name}. ${hint}`);
  }
}

requireTool("rustup", "Telepítés: https://rustup.rs (Windows: winget install Rustlang.Rustup)");
requireTool("cargo", "A rustup telepíti; nyiss új terminált a telepítés után.");

info("Rust célplatform: wasm32-unknown-unknown");
await runOrFail(["rustup", "target", "add", "wasm32-unknown-unknown"]);

const bindgenVersion = lockedCrateVersion("wasm-bindgen");
if (!bindgenVersion) {
  fail("A Cargo.lock nem tartalmaz wasm-bindgen verziót.");
}
const installed = await capture(["wasm-bindgen", "--version"]);
if (installed?.endsWith(bindgenVersion)) {
  info(`wasm-bindgen-cli ${bindgenVersion} már telepítve`);
} else {
  info(`wasm-bindgen-cli ${bindgenVersion} telepítése (a Cargo.lock verziója)`);
  await runOrFail([
    "cargo",
    "install",
    "wasm-bindgen-cli",
    "--locked",
    "--version",
    bindgenVersion,
  ]);
}

if (await capture(["wasm-opt", "--version"])) {
  info("wasm-opt elérhető");
} else if (withWasmOpt) {
  info("wasm-opt telepítése (ez eltarthat néhány percig)");
  if ((await run(["cargo", "install", "wasm-opt", "--locked"])) !== 0) {
    warn("A wasm-opt telepítése sikertelen; a build optimalizálás nélkül is működik.");
  }
} else {
  warn("A wasm-opt nincs telepítve; a .wasm optimalizálatlan lesz (just setup --with-wasm-opt).");
}

info("bun i");
await runOrFail(["bun", "i"]);

await runOrFail(["bun", join(root, "scripts", "build-wasm.ts")]);
await runOrFail(["bun", join(root, "scripts", "gen-types.ts")]);
await runOrFail(["bunx", "tsr", "generate"], { cwd: paths.web });

if (withE2e) {
  info("Playwright chromium telepítése");
  await runOrFail(["bunx", "playwright", "install", "--with-deps", "chromium"], {
    cwd: join(root, "e2e"),
  });
}

info("MySQL ellenőrzése (DATABASE_URL)");
if ((await run(["bun", join(root, "scripts", "db-setup.ts"), "--check"])) !== 0) {
  warn("A szerver indítása előtt készítsd elő a MySQL-t a fenti módok egyikével.");
}

info("Kész. Indítás: just dev → http://localhost:5173 (demo1 / demo2026)");
