import { z } from "zod";
import { LIMITS, VISIBILITIES } from "../db/schema.ts";

z.config(z.locales.hu());

export const MAX_MAP_TEXT = 1_000;
export const MAX_SOURCE = 100_000;

const ID_PATTERN = /^[1-9][0-9]{0,14}$/;
const ID_MESSAGE = "Az azonosító pozitív egész szám kell legyen.";
const NOT_WELL_FORMED =
  "A szöveg érvénytelen Unicode-karaktert (párosítatlan helyettesítő kódot) tartalmaz.";
const TITLE_BREAKS = /[\p{Cc}\s]+/gu;
const DESCRIPTION_CONTROLS = /[^\P{Cc}\t\n]/gu;
const LONE_SURROGATE = /\p{Cs}/u;
const VISIBLE = /[^\s\p{Cc}\p{Cf}\p{M}]/u;

const identifier = z.string({ error: ID_MESSAGE }).regex(ID_PATTERN, ID_MESSAGE).transform(Number);

function wellFormedText(label: string) {
  return z
    .string({ error: `${label} szöveg kell legyen.` })
    .refine((value) => !LONE_SURROGATE.test(value), NOT_WELL_FORMED);
}

export const idParam = z.object({ id: identifier });

export const credentialsSchema = z.object({
  username: z
    .string({ error: "A felhasználónév szöveg kell legyen." })
    .regex(
      new RegExp(`^[A-Za-z0-9_]{3,${LIMITS.username}}$`),
      `A felhasználónév 3–${LIMITS.username} karakter lehet: betű, számjegy vagy aláhúzás.`,
    ),
  password: wellFormedText("A jelszó")
    .min(8, "A jelszó legalább 8 karakter legyen.")
    .max(200, "A jelszó legfeljebb 200 karakter lehet."),
});

const title = wellFormedText("A cím")
  .transform((value) => value.replace(TITLE_BREAKS, " ").trim())
  .pipe(
    z
      .string()
      .max(LIMITS.title, `A cím legfeljebb ${LIMITS.title} karakter lehet.`)
      .refine((value) => VISIBLE.test(value), "A cím nem lehet üres."),
  );

const description = wellFormedText("A leírás")
  .transform((value) => value.replace(/\r\n?/g, "\n").replace(DESCRIPTION_CONTROLS, "").trim())
  .pipe(
    z.string().max(LIMITS.description, `A leírás legfeljebb ${LIMITS.description} karakter lehet.`),
  );

const content = z
  .string({ error: "A térkép szöveg kell legyen." })
  .max(MAX_MAP_TEXT, "A térkép túl hosszú.");

const visibility = z.enum(VISIBILITIES, {
  error: "A láthatóság „public” vagy „private” lehet.",
});

export const createMapSchema = z.object({
  title,
  description: description.default(""),
  visibility: visibility.default("public"),
  content,
});

export const updateMapSchema = z
  .object({
    title: title.optional(),
    description: description.optional(),
    visibility: visibility.optional(),
    content: content.optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: "Legalább egy mezőt módosítani kell.",
  });

export const listMapsQuery = z.object({
  scope: z.enum(["all", "mine"], { error: "A szűrő „all” vagy „mine” lehet." }).default("all"),
});

export const leaderboardQuery = z.object({
  version: identifier.optional(),
});

const source = wellFormedText("A program").max(MAX_SOURCE, "A program túl hosszú.");

export const programSchema = z.object({ title, source });

export const updateProgramSchema = z
  .object({ title: title.optional(), source: source.optional() })
  .refine((value) => value.title !== undefined || value.source !== undefined, {
    message: "Legalább egy mezőt módosítani kell.",
  });

export const runSchema = z.object({
  mapVersionId: z
    .number({ error: "A térképverzió azonosítója szám kell legyen." })
    .int(ID_MESSAGE)
    .positive(ID_MESSAGE)
    .max(Number.MAX_SAFE_INTEGER, ID_MESSAGE),
  source,
});

export const roleSchema = z.object({
  role: z.enum(["admin", "user"], { error: "A szerepkör „admin” vagy „user” lehet." }),
});
