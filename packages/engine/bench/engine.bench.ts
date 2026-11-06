import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createEngine } from "../src/index.ts";

const corpus = process.argv[2];
if (!corpus) {
  console.error("Használat: bun bench/engine.bench.ts <korpusz mappa>");
  process.exit(1);
}

const wasmPath = new URL("../pkg/minescript_wasm_bg.wasm", import.meta.url);
const engine = createEngine(readFileSync(wasmPath));
const filter = process.argv[3] ?? "";

function measure(label: string, work: () => unknown): void {
  if (!label.includes(filter)) return;
  const warmupUntil = performance.now() + 150;
  while (performance.now() < warmupUntil) work();
  const samples: number[] = [];
  const stopAt = performance.now() + 600;
  while (performance.now() < stopAt || samples.length < 10) {
    const started = performance.now();
    let iterations = 0;
    while (performance.now() - started < 5) {
      work();
      iterations += 1;
    }
    samples.push((performance.now() - started) / iterations);
  }
  samples.sort((a, b) => a - b);
  const median = samples[Math.floor(samples.length / 2)] ?? 0;
  console.log(`${label.padEnd(44)} ${(median * 1000).toFixed(2).padStart(10)} µs`);
}

const runDir = join(corpus, "run");
for (const file of readdirSync(runDir)
  .filter((name) => name.endsWith(".ms"))
  .sort()) {
  const name = file.slice(0, -3);
  const source = readFileSync(join(runDir, file), "utf8");
  const map = readFileSync(join(runDir, `${name}.txt`), "utf8");
  measure(`run/${name}`, () => engine.run(source, map));
}

const sourceDir = join(corpus, "source");
for (const file of readdirSync(sourceDir).sort()) {
  const name = file.slice(0, -3);
  const source = readFileSync(join(sourceDir, file), "utf8");
  measure(`analyze/${name}`, () => engine.analyze(source));
  measure(`format/${name}`, () => engine.format(source));
  measure(`complete/${name}`, () => engine.complete(source, source.length >> 1));
}
