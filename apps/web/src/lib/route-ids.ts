import { notFound } from "@tanstack/react-router";
import { ApiError } from "./api.ts";

const ID_PATTERN = /^[1-9][0-9]{0,14}$/;

export function routeId(raw: string): number {
  if (!ID_PATTERN.test(raw)) {
    throw notFound();
  }
  return Number(raw);
}

export async function orNotFound<T>(request: Promise<T>): Promise<T | undefined> {
  try {
    return await request;
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) {
      throw notFound();
    }
    if (error instanceof ApiError) {
      return undefined;
    }
    throw error;
  }
}
