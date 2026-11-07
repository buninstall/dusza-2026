import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { JSONValue } from "hono/utils/types";

export type ApiErrorBody = {
  error: { code: string; message: string; details?: JSONValue };
};

export function apiError<Status extends ContentfulStatusCode>(
  c: Context,
  status: Status,
  code: string,
  message: string,
  details?: JSONValue,
) {
  const error = details === undefined ? { code, message } : { code, message, details };
  return c.json({ error }, status);
}

export const messages = {
  unauthenticated: "Ehhez a művelethez be kell jelentkezned.",
  forbidden: "Ehhez a művelethez nincs jogosultságod.",
  notFound: "A keresett erőforrás nem található.",
  validation: "A kérés adatai hibásak.",
  internal: "Váratlan szerverhiba történt. Próbáld újra később.",
  unavailable: "Az adatbázis pillanatnyilag nem érhető el. Próbáld újra egy pillanat múlva.",
  csrf: "A kérés forrása nem engedélyezett.",
  malformedJson: "A kérés törzse nem érvényes JSON.",
  payloadTooLarge: "A kérés túl nagy (legfeljebb 1 MiB lehet).",
  desktopUnavailable: "Az asztali alkalmazás letöltése most nem érhető el. Próbáld újra később.",
} as const;
