import { describe, expect, setDefaultTimeout, test } from "bun:test";
import { join } from "node:path";
import { MUTANTS } from "./mutation-core.ts";

setDefaultTimeout(180_000);

const worker = join(import.meta.dir, "mutation-worker.ts");

async function killedBy(index: number): Promise<string[]> {
  const child = Bun.spawn([process.execPath, worker, String(index)], {
    cwd: join(import.meta.dir, ".."),
    stdout: "pipe",
    stderr: "pipe",
  });
  const [output, errors] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  const code = await child.exited;
  const line = output.split("\n").find((entry) => entry.startsWith("@@RESULT "));
  if (!line)
    throw new Error(
      `A mutáns-futtató nem adott eredményt (kilépési kód ${code}):\n${errors.slice(-2000)}`,
    );
  return (JSON.parse(line.slice("@@RESULT ".length)) as { killed: string[] }).killed;
}

describe("mutációs ellenőrzés: a conformance-csomag minden elrontott referencián elbukik", () => {
  test("a változatlan másolat minden conformance-esetet teljesít", async () => {
    expect(await killedBy(-1)).toEqual([]);
  });

  MUTANTS.forEach((mutant, index) => {
    test(`elbukik, ha ${mutant.name}`, async () => {
      expect((await killedBy(index)).length).toBeGreaterThan(0);
    });
  });
});
