import { info, paint, run } from "./lib.ts";

info("Rust conformance");
const rust = await run(["cargo", "test", "-p", "minescript-core", "--test", "conformance"]);

info("WASM conformance");
const wasm = await run(["bun", "test", "test/conformance.test.ts"], { cwd: "packages/engine" });

info("Referencia-interpreter ↔ WASM-motor (differenciális teszt)");
const differential = await run(["bun", "test", "--timeout", "600000", "test/diff.test.ts"], {
  cwd: "tools/reference-interpreter",
});

const ok = rust === 0 && wasm === 0 && differential === 0;
console.log(
  ok ? paint("green", "✓ Minden conformance-eset zöld.") : paint("red", "✗ Van piros eset."),
);
process.exit(ok ? 0 : 1);
