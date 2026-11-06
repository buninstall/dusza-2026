import { mkdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { info, paths, runOrFail } from "./lib.ts";

export const TARGETS = [
  { target: "bun-windows-x64", file: "minescript-windows-x64.exe" },
  { target: "bun-linux-x64", file: "minescript-linux-x64" },
  { target: "bun-darwin-arm64", file: "minescript-macos-arm64" },
] as const;

const entry = join(paths.server, "src", "index.ts");
mkdirSync(paths.release, { recursive: true });

const requested = Bun.argv.slice(2);
const selected = TARGETS.filter(
  (item) => requested.length === 0 || requested.includes(item.target),
);

for (const { target, file } of selected) {
  const outfile = join(paths.release, file);
  info(`${target} → release/${file}`);
  await runOrFail(
    ["bun", "build", entry, "--compile", "--minify", `--target=${target}`, "--outfile", outfile],
    { cwd: paths.server },
  );
  const mib = (statSync(outfile).size / 1024 / 1024).toFixed(1);
  info(`  ${file}: ${mib} MiB`);
}
