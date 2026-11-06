import type { AppType } from "@minescript/server";
import { hc } from "hono/client";
import { resilientFetch } from "./resilient-fetch.ts";

export const api = hc<AppType>("/api", { init: { credentials: "include" }, fetch: resilientFetch });

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

const MAX_DETAILS = 3;

function detailMessages(details: unknown): string[] {
  if (!Array.isArray(details)) {
    return [];
  }
  const messages = details.flatMap((item: unknown) => {
    const message = (item as { message?: unknown } | null)?.message;
    return typeof message === "string" ? [message] : [];
  });
  return [...new Set(messages)].slice(0, MAX_DETAILS);
}

export function errorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof ApiError)) {
    return fallback;
  }
  const details = detailMessages(error.details).filter((detail) => detail !== error.message);
  return details.length === 0 ? error.message : `${error.message} ${details.join(" ")}`;
}
