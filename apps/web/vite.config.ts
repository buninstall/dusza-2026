import type { ServerResponse } from "node:http";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type ProxyOptions } from "vite";

const apiTarget = process.env.MINESCRIPT_API_URL ?? "http://127.0.0.1:8080";

const UNAVAILABLE = JSON.stringify({
  error: { code: "UNAVAILABLE", message: "A szerver újraindul, egy pillanat." },
});

function isResponse(target: unknown): target is ServerResponse {
  return typeof target === "object" && target !== null && "writeHead" in target;
}

const configureProxy: ProxyOptions["configure"] = (proxy) => {
  proxy.on("error", (error: NodeJS.ErrnoException, _request, target) => {
    if (!isResponse(target) || target.headersSent || target.writableEnded) {
      return;
    }
    target.writeHead(503, {
      "Content-Type": "application/json; charset=utf-8",
      "Retry-After": "1",
      ...(error.code === "ECONNREFUSED" ? { "X-Retry-Safe": "1" } : {}),
    });
    target.end(UNAVAILABLE);
  });
};

export default defineConfig({
  plugins: [tanstackRouter({ target: "react", autoCodeSplitting: true }), react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": { target: apiTarget, changeOrigin: false, configure: configureProxy },
    },
    fs: { allow: ["../.."] },
  },
  build: {
    target: "es2022",
    assetsInlineLimit: 0,
    sourcemap: false,
  },
});
