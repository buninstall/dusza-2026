import { afterEach, beforeEach } from "bun:test";

let sequence = 0;
let startedAt = 0;

beforeEach(() => {
  sequence += 1;
  startedAt = performance.now();
  process.stderr.write(`@@TC START ${sequence}\n`);
});

afterEach(() => {
  process.stderr.write(`@@TC END ${sequence} ${(performance.now() - startedAt).toFixed(2)}\n`);
});
