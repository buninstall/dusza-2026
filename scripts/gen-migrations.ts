import { readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { info, paths, runOrFail } from "./lib.ts";

const drizzleDir = join(paths.server, "drizzle");
const output = join(paths.server, "src", "db", "migrations.gen.ts");

const files = readdirSync(drizzleDir)
  .filter((file) => file.endsWith(".sql"))
  .sort();

const imports = files.map(
  (file, index) => `import migration${index} from "../../drizzle/${file}" with { type: "text" };`,
);
const entries = files.map(
  (file, index) => `  { name: "${file.replace(/\.sql$/, "")}", sql: migration${index} },`,
);

const source = [
  ...imports,
  "",
  "export type Migration = { readonly name: string; readonly sql: string };",
  "",
  "export const migrations: readonly Migration[] = [",
  ...entries,
  "];",
  "",
].join("\n");

writeFileSync(output, source);
await runOrFail(["bunx", "biome", "format", "--write", output], { quiet: true });
info(`${files.length} migráció → apps/server/src/db/migrations.gen.ts`);
