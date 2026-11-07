import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { brotliDecompressSync } from "node:zlib";
import { createApp } from "../src/app.ts";
import { createStaticHandler, mimeTypeOf, pickEncoding } from "../src/static.ts";
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

  test("a nagyobb szöveges és wasm fájlok tömörítve mennek, ha a böngésző kéri", async () => {
    await using context = await createTestContext();
    const script = "export const x = 1;\n".repeat(200);
    const handler = createStaticHandler({
      "/index.html": file("index2.html", "<!doctype html><title>MineScript</title>"),
      "/assets/app-abc.js": file("app.js", script),
    });
    const app = createApp(context.deps, { staticHandler: handler });

    const br = await app.request("http://localhost/assets/app-abc.js", {
      headers: { "accept-encoding": "gzip, deflate, br" },
    });
    expect(br.headers.get("content-encoding")).toBe("br");
    expect(br.headers.get("vary")).toBe("Accept-Encoding");
    const brBody = new Uint8Array(await br.arrayBuffer());
    expect(brBody.byteLength).toBeLessThan(script.length);
    expect(new TextDecoder().decode(brotliDecompressSync(brBody))).toBe(script);

    const gzip = await app.request("http://localhost/assets/app-abc.js", {
      headers: { "accept-encoding": "gzip" },
    });
    expect(gzip.headers.get("content-encoding")).toBe("gzip");
    expect(new TextDecoder().decode(Bun.gunzipSync(new Uint8Array(await gzip.arrayBuffer())))).toBe(
      script,
    );

    const plain = await app.request("http://localhost/assets/app-abc.js");
    expect(plain.headers.get("content-encoding")).toBeNull();
    expect(await plain.text()).toBe(script);

    const small = await app.request("http://localhost/play/1", {
      headers: { "accept-encoding": "br" },
    });
    expect(small.headers.get("content-encoding")).toBeNull();
  });

  test("az index.html ETaggel újraellenőrizhető, a hibás URL-kódolás nem szerverhiba", async () => {
    await using context = await createTestContext();
    const page = "<!doctype html><title>MineScript</title>".repeat(60);
    const handler = createStaticHandler({ "/index.html": file("index3.html", page) });
    const app = createApp(context.deps, { staticHandler: handler });

    const first = await app.request("http://localhost/maps", {
      headers: { "accept-encoding": "br" },
    });
    const tag = first.headers.get("etag");
    expect(first.status).toBe(200);
    expect(tag).toMatch(/^".+-br"$/);

    const again = await app.request("http://localhost/play/2", {
      headers: { "accept-encoding": "br", "if-none-match": tag ?? "" },
    });
    expect(again.status).toBe(304);
    expect(await again.text()).toBe("");

    const plain = await app.request("http://localhost/maps", {
      headers: { "if-none-match": tag ?? "" },
    });
    expect(plain.status).toBe(200);
    expect(await plain.text()).toBe(page);

    const broken = await app.request("http://localhost/%E0%A4%A");
    expect(broken.status).toBe(404);
    expect(broken.headers.get("content-type")).toContain("application/json");
  });

  test("a tömörítés választása az Accept-Encoding alapján", () => {
    expect(pickEncoding("gzip, br;q=1")).toBe("br");
    expect(pickEncoding("gzip")).toBe("gzip");
    expect(pickEncoding("identity")).toBeNull();
    expect(pickEncoding(undefined)).toBeNull();
  });

  test("ismeretlen kiterjesztés bináris", () => {
    expect(mimeTypeOf("/a.unknown")).toBe("application/octet-stream");
    expect(mimeTypeOf("/fonts/inter.woff2")).toBe("font/woff2");
  });
});
