import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { info, paths, runOrFail } from "./lib.ts";

const exportDir = join(paths.target, "ts-bindings");
rmSync(exportDir, { recursive: true, force: true });
mkdirSync(exportDir, { recursive: true });

info("ts-rs export (cargo test export_bindings)");
await runOrFail(
  [
    "cargo",
    "test",
    "-p",
    "minescript-core",
    "--test",
    "export_bindings",
    "--",
    "--ignored",
    "--quiet",
  ],
  { env: { TS_RS_EXPORT_DIR: exportDir, TS_RS_LARGE_INT: "number" } },
);

function withoutComments(source: string): string {
  return source
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("//"))
    .join("\n")
    .replace(/^\n+/, "");
}

rmSync(paths.generated, { recursive: true, force: true });
mkdirSync(paths.generated, { recursive: true });

const files = readdirSync(exportDir)
  .filter((file) => file.endsWith(".ts"))
  .sort();
for (const file of files) {
  const source = readFileSync(join(exportDir, file), "utf8");
  writeFileSync(join(paths.generated, file), withoutComments(source));
}

const barrel = files
  .map((file) => file.replace(/\.ts$/, ""))
  .map((name) => `export type { ${name} } from "./${name}";`)
  .join("\n");
writeFileSync(join(paths.generated, "index.ts"), `${barrel}\n`);

await runOrFail(["bunx", "biome", "format", "--write", paths.generated], { quiet: true });
info(`${files.length} típus → packages/engine/src/generated`);
