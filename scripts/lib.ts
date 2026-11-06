import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { delimiter, join, resolve } from "node:path";

export const root = resolve(import.meta.dir, "..");

const cargoBin = join(process.env.CARGO_HOME ?? join(homedir(), ".cargo"), "bin");
if (existsSync(cargoBin) && !(process.env.PATH ?? "").split(delimiter).includes(cargoBin)) {
  process.env.PATH = `${cargoBin}${delimiter}${process.env.PATH ?? ""}`;
}

export const paths = {
  engine: join(root, "packages", "engine"),
  enginePkg: join(root, "packages", "engine", "pkg"),
  generated: join(root, "packages", "engine", "src", "generated"),
  web: join(root, "apps", "web"),
  webDist: join(root, "apps", "web", "dist"),
  server: join(root, "apps", "server"),
  release: join(root, "release"),
  target: join(root, "target"),
};

const colors = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
};

export type Color = Exclude<keyof typeof colors, "reset">;

export function paint(color: Color, text: string): string {
  return `${colors[color]}${text}${colors.reset}`;
}

export function info(message: string): void {
  console.log(paint("cyan", `› ${message}`));
}

export function warn(message: string): void {
  console.warn(paint("yellow", `! ${message}`));
}

export function fail(message: string): never {
  console.error(paint("red", `✗ ${message}`));
  process.exit(1);
}

export type RunOptions = {
  cwd?: string;
  env?: Record<string, string>;
  quiet?: boolean;
};

export async function run(command: string[], options: RunOptions = {}): Promise<number> {
  const child = Bun.spawn(command, {
    cwd: options.cwd ?? root,
    env: { ...process.env, ...options.env },
    stdout: options.quiet ? "ignore" : "inherit",
    stderr: options.quiet ? "ignore" : "inherit",
    stdin: "inherit",
  });
  return child.exited;
}

export async function runOrFail(command: string[], options: RunOptions = {}): Promise<void> {
  const code = await run(command, options);
  if (code !== 0) {
    fail(`A parancs sikertelen (${code}): ${command.join(" ")}`);
  }
}

export async function capture(command: string[], cwd: string = root): Promise<string | null> {
  if (!Bun.which(command[0] ?? "")) {
    return null;
  }
  const child = Bun.spawn(command, { cwd, stdout: "pipe", stderr: "pipe" });
  const [text, code] = await Promise.all([new Response(child.stdout).text(), child.exited]);
  return code === 0 ? text.trim() : null;
}

export function lockedCrateVersion(name: string): string | null {
  const lockPath = join(root, "Cargo.lock");
  if (!existsSync(lockPath)) {
    return null;
  }
  const lock = readFileSync(lockPath, "utf8");
  const pattern = new RegExp(`\\[\\[package\\]\\]\\nname = "${name}"\\nversion = "([^"]+)"`);
  return pattern.exec(lock.replaceAll("\r\n", "\n"))?.[1] ?? null;
}

export function exe(name: string): string {
  return process.platform === "win32" ? `${name}.exe` : name;
}
