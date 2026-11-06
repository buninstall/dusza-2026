import type { RunResult } from "@minescript/engine";

export function run(src: string, mapText: string): RunResult {
  throw new Error(
    `A referencia-interpreter még nem készült el (forrás: ${src.length} karakter, térkép: ${mapText.length} karakter).`,
  );
}
