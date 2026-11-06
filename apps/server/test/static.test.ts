import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../src/app.ts";
import { createStaticHandler, mimeTypeOf } from "../src/static.ts";
import { createTestContext } from "./helpers.ts";

const dir = mkdtempSync(join(tmpdir(), "minescript-static-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

function file(name: string, content: string): string {
  const path = join(dir, name);
  writeFileSync(path, content);
  return path;
}

describe("statikus kiszolgálás", () => {
  test("MIME-típusok, cache és SPA-fallback", async () => {
    await using context = await createTestContext();
    const { deps } = context;
    const handler = createStaticHandler({
      "/index.html": file("index.html", "<!doctype html><title>MineScript</title>"),
      "/assets/engine-abc123.wasm": file("engine.wasm", "wasm"),
    });
    const app = createApp(deps, { staticHandler: handler });

    const wasm = await app.request("http://localhost/assets/engine-abc123.wasm");
    expect(wasm.headers.get("content-type")).toBe("application/wasm");
    expect(wasm.headers.get("cache-control")).toContain("immutable");

    const spa = await app.request("http://localhost/play/3");
    expect(spa.status).toBe(200);
    expect(spa.headers.get("content-type")).toContain("text/html");
    expect(await spa.text()).toContain("MineScript");

    const api = await app.request("http://localhost/api/nincs");
    expect(api.status).toBe(404);
    expect(api.headers.get("content-type")).toContain("application/json");
  });

  test("index.html nélkül az ismeretlen útvonal egységes 404", async () => {
    await using context = await createTestContext();
    const app = createApp(context.deps, { staticHandler: createStaticHandler({}) });
    const response = await app.request("http://localhost/play/3");
    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toContain("application/json");
  });

  test("ismeretlen kiterjesztés bináris", () => {
    expect(mimeTypeOf("/a.unknown")).toBe("application/octet-stream");
    expect(mimeTypeOf("/fonts/inter.woff2")).toBe("font/woff2");
  });
});
