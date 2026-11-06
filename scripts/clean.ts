import { rmSync } from "node:fs";
import { join } from "node:path";
import { info, paths, root } from "./lib.ts";

const generatedArtifacts = [
  paths.enginePkg,
  paths.webDist,
  paths.release,
  join(paths.server, "src", "static-manifest.gen.js"),
  join(root, "e2e", "test-results"),
  join(root, "e2e", "playwright-report"),
];

for (const path of generatedArtifacts) {
  rmSync(path, { recursive: true, force: true });
}
info(`${generatedArtifacts.length} generált útvonal törölve.`);
