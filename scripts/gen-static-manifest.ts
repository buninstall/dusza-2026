import { existsSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fail, info, paths } from "./lib.ts";

const output = join(paths.server, "src", "static-manifest.gen.js");

if (!existsSync(join(paths.webDist, "index.html"))) {
  fail("Nincs buildelt web (apps/web/dist). Futtasd: just build");
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const files = walk(paths.webDist).sort();
const lines = files.map((file, index) => {
  const fromServer = relative(join(paths.server, "src"), file).split(sep).join("/");
  return `import file${index} from "${fromServer}" with { type: "file" };`;
});
const entries = files.map((file, index) => {
  const urlPath = `/${relative(paths.webDist, file).split(sep).join("/")}`;
  return `  ${JSON.stringify(urlPath)}: file${index},`;
});

const source = [...lines, "", "export const staticFiles = {", ...entries, "};", ""].join("\n");

writeFileSync(output, source);
info(`${files.length} statikus fájl → apps/server/src/static-manifest.gen.js`);
