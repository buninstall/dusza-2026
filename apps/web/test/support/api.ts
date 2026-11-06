import { vi } from "vitest";
import { wasmBytes } from "./engine.ts";

export type ApiRequest = { method: string; path: string; body: unknown; search: URLSearchParams };

export type ApiReply = { status?: number; body: unknown };

type Handler = (request: ApiRequest) => ApiReply;

const routes = new Map<string, Handler>();
export const calls: ApiRequest[] = [];

export function onApi(method: string, path: string, handler: Handler): void {
  routes.set(`${method} ${path}`, handler);
}

export function respond(method: string, path: string, body: unknown, status = 200): void {
  onApi(method, path, () => ({ status, body }));
}

export function apiError(status: number, code: string, message: string): ApiReply {
  return { status, body: { error: { code, message } } };
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function matches(key: string, method: string, path: string): boolean {
  const [routeMethod, routePath = ""] = key.split(" ");
  const pattern = new RegExp(`^${routePath.replace(/:[a-z]+/gi, "[^/]+")}$`);
  return routeMethod === method && pattern.test(path);
}

async function fakeFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const raw = input instanceof Request ? input.url : String(input);
  if (raw.includes(".wasm")) {
    return new Response(wasmBytes, { status: 200 });
  }
  const url = new URL(raw, "http://localhost");
  const method = (init?.method ?? "GET").toUpperCase();
  const path = url.pathname.replace(/^\/api/, "");
  const body = typeof init?.body === "string" ? (JSON.parse(init.body) as unknown) : null;
  const request = { method, path, body, search: url.searchParams };
  calls.push(request);
  const handler =
    routes.get(`${method} ${path}`) ?? [...routes].find(([key]) => matches(key, method, path))?.[1];
  if (!handler) {
    return json(404, { error: { code: "NOT_FOUND", message: `${method} ${path}` } });
  }
  const reply = handler(request);
  return json(reply.status ?? 200, reply.body);
}

export function installApi(): void {
  vi.stubGlobal("fetch", vi.fn(fakeFetch));
}

export function resetApi(): void {
  routes.clear();
  calls.length = 0;
  vi.unstubAllGlobals();
}

export function callsTo(method: string, path: string): ApiRequest[] {
  return calls.filter((call) => call.method === method && call.path === path);
}
