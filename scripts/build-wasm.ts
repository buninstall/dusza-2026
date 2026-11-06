import { statSync } from "node:fs";
import { join } from "node:path";
import { capture, fail, info, paths, runOrFail, warn } from "./lib.ts";

const WASM_OPT_FEATURES = [
  "--enable-bulk-memory",
  "--enable-mutable-globals",
  "--enable-nontrapping-float-to-int",
  "--enable-sign-ext",
  "--enable-reference-types",
  "--enable-multivalue",
];

if (!Bun.which("wasm-bindgen")) {
  fail("Hiányzik a wasm-bindgen. Futtasd: just setup");
}

info("A minescript-wasm fordítása (wasm32-unknown-unknown, release)");
await runOrFail([
  "cargo",
  "build",
  "-p",
  "minescript-wasm",
  "--target",
  "wasm32-unknown-unknown",
  "--release",
]);

const builtWasm = join(paths.target, "wasm32-unknown-unknown", "release", "minescript_wasm.wasm");
info("wasm-bindgen → packages/engine/pkg");
await runOrFail(["wasm-bindgen", builtWasm, "--target", "web", "--out-dir", paths.enginePkg]);

const outputWasm = join(paths.enginePkg, "minescript_wasm_bg.wasm");
if (await capture(["wasm-opt", "--version"])) {
  info("wasm-opt -Os");
  await runOrFail(["wasm-opt", "-Os", ...WASM_OPT_FEATURES, outputWasm, "-o", outputWasm]);
} else {
  warn("A wasm-opt nem található, a .wasm optimalizálatlan marad (just setup --with-wasm-opt).");
}

const kib = (statSync(outputWasm).size / 1024).toFixed(1);
info(`Kész: ${outputWasm} (${kib} KiB)`);
