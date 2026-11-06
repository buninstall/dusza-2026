import { info, paint, run } from "./lib.ts";

info("Rust conformance (maps + kikapcsolt syntax/runtime esetek)");
const rust = await run([
  "cargo",
  "test",
  "-p",
  "minescript-core",
  "--test",
  "conformance",
  "--",
  "--include-ignored",
]);

info("WASM conformance (bun test, CONFORMANCE=1)");
const wasm = await run(["bun", "test", "test/conformance.test.ts"], {
  cwd: "packages/engine",
  env: { CONFORMANCE: "1" },
});

const ok = rust === 0 && wasm === 0;
console.log(
  ok
    ? paint("green", "✓ Minden conformance-eset zöld.")
    : paint("yellow", "! Van piros conformance-eset (amíg a parser és a VM stub, ez várható)."),
);
process.exit(ok ? 0 : 1);
