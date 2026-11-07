import { join } from "node:path";
import type { BunPlugin } from "bun";

const webModules = join(import.meta.dir, "..", "..", "..", "apps", "web", "node_modules");

export type Asset = { body: Uint8Array<ArrayBuffer>; type: string };

const TYPES: Record<string, string> = {
  js: "text/javascript; charset=utf-8",
  css: "text/css; charset=utf-8",
  woff2: "font/woff2",
  woff: "font/woff",
  svg: "image/svg+xml",
};

const sharedModules: BunPlugin = {
  name: "minescript-web-modules",
  setup(build) {
    build.onResolve({ filter: /^[^./]/ }, (args) => {
      if (!args.importer || args.importer.includes("node_modules")) return undefined;
      return { path: Bun.resolveSync(args.path, webModules) };
    });
  },
};

async function bundle(entry: string, assets: Map<string, Asset>): Promise<void> {
  const result = await Bun.build({
    entrypoints: [join(import.meta.dir, `${entry}.tsx`)],
    target: "browser",
    format: "esm",
    minify: true,
    splitting: false,
    sourcemap: "none",
    naming: {
      entry: `${entry}.[ext]`,
      asset: "assets/[name]-[hash].[ext]",
      chunk: `${entry}-[hash].[ext]`,
    },
    publicPath: "/ui/",
    define: { "process.env.NODE_ENV": '"production"' },
    plugins: [sharedModules],
  });
  if (!result.success) {
    throw new Error(
      `A felület nem fordítható:\n${result.logs.map((log) => String(log)).join("\n")}`,
    );
  }
  for (const output of result.outputs) {
    const parts = output.path
      .replaceAll("\\", "/")
      .split("/")
      .filter((part) => part !== "." && part !== "");
    const relativePath = (parts.at(-2) === "assets" ? parts.slice(-2) : parts.slice(-1)).join("/");
    const extension = relativePath.split(".").at(-1) ?? "";
    assets.set(`/ui/${relativePath}`, {
      body: new Uint8Array(await output.arrayBuffer()),
      type: TYPES[extension] ?? "application/octet-stream",
    });
  }
}

export async function buildUi(): Promise<Map<string, Asset>> {
  const assets = new Map<string, Asset>();
  await bundle("login", assets);
  await bundle("app", assets);
  return assets;
}
