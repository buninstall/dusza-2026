import { z } from "zod";
import { VISIBILITIES } from "../db/schema.ts";

export const idParam = z.object({
  id: z.coerce.number({ message: "Az azonosító szám kell legyen." }).int().positive(),
});

export const credentialsSchema = z.object({
  username: z
    .string()
    .regex(
      /^[A-Za-z0-9_]{3,24}$/,
      "A felhasználónév 3–24 karakter lehet: betű, számjegy vagy aláhúzás.",
    ),
  password: z
    .string()
    .min(8, "A jelszó legalább 8 karakter legyen.")
    .max(200, "A jelszó legfeljebb 200 karakter lehet."),
});

export const MAX_MAP_TEXT = 1_000;
export const MAX_SOURCE = 100_000;

const title = z
  .string()
  .trim()
  .min(1, "A cím nem lehet üres.")
  .max(80, "A cím legfeljebb 80 karakter lehet.");
const description = z.string().trim().max(500, "A leírás legfeljebb 500 karakter lehet.");
const content = z.string().max(MAX_MAP_TEXT, "A térkép túl hosszú.");

export const createMapSchema = z.object({
  title,
  description: description.default(""),
  visibility: z.enum(VISIBILITIES).default("public"),
  content,
});

export const updateMapSchema = z
  .object({
    title: title.optional(),
    description: description.optional(),
    visibility: z.enum(VISIBILITIES).optional(),
    content: content.optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: "Legalább egy mezőt módosítani kell.",
  });

export const listMapsQuery = z.object({
  scope: z.enum(["all", "mine"]).default("all"),
});

export const leaderboardQuery = z.object({
  version: z.coerce.number().int().positive().optional(),
});

const source = z.string().max(MAX_SOURCE, "A program túl hosszú.");

export const programSchema = z.object({ title, source });

export const updateProgramSchema = z
  .object({ title: title.optional(), source: source.optional() })
  .refine((value) => value.title !== undefined || value.source !== undefined, {
    message: "Legalább egy mezőt módosítani kell.",
  });

export const runSchema = z.object({
  mapVersionId: z.number().int().positive(),
  source,
});

export const roleSchema = z.object({ role: z.enum(["admin", "user"]) });
