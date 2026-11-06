import type { Context } from "hono";
import type { z } from "zod";
import { apiError, messages } from "./errors.ts";

type ValidationResult =
  | { success: true }
  | { success: false; error: { issues: readonly z.core.$ZodIssue[] } };

export function validationHook(result: ValidationResult, c: Context) {
  if (result.success) {
    return undefined;
  }
  const details = result.error.issues.map((issue) => ({
    path: issue.path.map(String).join("."),
    message: issue.message,
  }));
  return apiError(c, 400, "VALIDATION", messages.validation, details);
}
