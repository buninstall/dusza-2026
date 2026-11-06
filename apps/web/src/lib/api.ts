import type { AppType } from "@minescript/server";
import { hc } from "hono/client";

export const api = hc<AppType>("/api", { init: { credentials: "include" } });

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type ErrorBody = { error?: { code?: unknown; message?: unknown; details?: unknown } };

function toApiError(status: number, body: unknown): ApiError {
  const error = (body as ErrorBody | null)?.error;
  const code = typeof error?.code === "string" ? error.code : "HTTP_ERROR";
  const message =
    typeof error?.message === "string" ? error.message : `A kérés sikertelen (${status}).`;
  return new ApiError(status, code, message, error?.details);
}

type ResponseLike = { ok: boolean; status: number; json(): Promise<unknown> };

export type SuccessBody<R> = R extends { ok: true; json(): Promise<infer Body> } ? Body : never;

export async function call<R extends ResponseLike>(request: Promise<R>): Promise<SuccessBody<R>> {
  let response: R;
  try {
    response = await request;
  } catch {
    throw new ApiError(0, "NETWORK", "A szerver nem érhető el. Ellenőrizd, hogy fut-e.");
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw toApiError(response.status, body);
  }
  return (await response.json()) as SuccessBody<R>;
}

export function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}
