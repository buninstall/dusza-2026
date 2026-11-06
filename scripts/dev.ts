import { type FSWatcher, watch } from "node:fs";
import { join } from "node:path";
import { type Color, paint, paths, root, run } from "./lib.ts";

const REBUILD_DEBOUNCE_MS = 400;

type Child = { name: string; process: Bun.Subprocess<"ignore", "pipe", "pipe"> };

const children: Child[] = [];
let shuttingDown = false;

async function pipeLines(stream: ReadableStream<Uint8Array>, prefix: string): Promise<void> {
  const decoder = new TextDecoder();
  let buffer = "";
  for await (const chunk of stream) {
    buffer += decoder.decode(chunk, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      console.log(`${prefix} ${line}`);
    }
  }
  if (buffer) {
    console.log(`${prefix} ${buffer}`);
  }
}

const SERVER_PORT = "8080";

function start(name: string, color: Color, command: string[], cwd: string): void {
  const { PORT: _ignoredPort, ...inherited } = process.env;
  const child = Bun.spawn(command, {
    cwd,
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
    env: { ...inherited, FORCE_COLOR: "1" },
  });
  const prefix = paint(color, `[${name}]`);
  void pipeLines(child.stdout, prefix);
  void pipeLines(child.stderr, prefix);
  void child.exited.then((code) => {
    if (!shuttingDown) {
      console.log(paint("red", `[${name}] leállt (${code}).`));
    }
  });
  children.push({ name, process: child });
}

let rebuildTimer: ReturnType<typeof setTimeout> | undefined;
let rebuilding = false;
let rebuildQueued = false;

async function rebuildEngine(): Promise<void> {
  if (rebuilding) {
    rebuildQueued = true;
    return;
  }
  rebuilding = true;
  console.log(paint("magenta", "[wasm] a crates/ változott, újraépítés…"));
  const wasm = await run(["bun", join(root, "scripts", "build-wasm.ts")]);
  const types = wasm === 0 ? await run(["bun", join(root, "scripts", "gen-types.ts")]) : wasm;
  console.log(
    types === 0
      ? paint("magenta", "[wasm] kész, a szervert és a webet frissítsd szükség szerint.")
      : paint("red", "[wasm] az újraépítés sikertelen, javítsd a hibát."),
  );
  rebuilding = false;
  if (rebuildQueued) {
    rebuildQueued = false;
    await rebuildEngine();
  }
}

function watchCrates(): FSWatcher {
  return watch(join(root, "crates"), { recursive: true }, (_event, filename) => {
    if (!filename || filename.includes("target")) {
      return;
    }
    clearTimeout(rebuildTimer);
    rebuildTimer = setTimeout(() => void rebuildEngine(), REBUILD_DEBOUNCE_MS);
  });
}

function shutdown(): void {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  console.log(paint("dim", "\nLeállítás…"));
  for (const child of children) {
    child.process.kill();
  }
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

start(
  "server",
  "cyan",
  ["bun", "--watch", "src/index.ts", "--no-open", "--port", SERVER_PORT],
  paths.server,
);
start("web", "green", ["bun", "run", "dev"], paths.web);
const watcher = watchCrates();
process.on("exit", () => watcher.close());
console.log(paint("yellow", "Fejlesztői mód: http://localhost:5173 (Ctrl+C a leállításhoz)"));
