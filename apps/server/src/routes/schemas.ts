import { z } from "zod";
import { LAMP_MODES, LIMITS, VISIBILITIES } from "../db/schema.ts";
import { DIFFICULTIES, GENERATOR_MAX, GENERATOR_MIN } from "../services/generator.ts";
import { LEVEL_FILTERS, MAP_SCOPES, MAP_SORTS, MAP_WORLDS } from "../services/map-list.ts";

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

const PAR_MESSAGE = `A célérték 1 és ${LIMITS.parSteps} közötti egész szám lehet.`;

const parSteps = z
  .number({ error: PAR_MESSAGE })
  .int(PAR_MESSAGE)
  .min(1, PAR_MESSAGE)
  .max(LIMITS.parSteps, PAR_MESSAGE)
  .nullable();

const lampMode = z.enum(LAMP_MODES, {
  error: "A lámpa-fokozat „open”, „lamp” vagy „dark” lehet.",
});

export const createMapSchema = z.object({
  title,
  description: description.default(""),
  visibility: visibility.default("public"),
  parSteps: parSteps.default(null),
  lampMode: lampMode.default("open"),
  content,
});

export const updateMapSchema = z
  .object({
    title: title.optional(),
    description: description.optional(),
    visibility: visibility.optional(),
    parSteps: parSteps.optional(),
    lampMode: lampMode.optional(),
    content: content.optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: "Legalább egy mezőt módosítani kell.",
  });

const SIZE_MESSAGE = `A méret ${GENERATOR_MIN} és ${GENERATOR_MAX} közötti egész szám lehet.`;
const generatorSize = z
  .number({ error: SIZE_MESSAGE })
  .int(SIZE_MESSAGE)
  .min(GENERATOR_MIN, SIZE_MESSAGE)
  .max(GENERATOR_MAX, SIZE_MESSAGE);

export const generateMapSchema = z.object({
  rows: generatorSize,
  cols: generatorSize,
  difficulty: z.enum(DIFFICULTIES, { error: "A nehézség „easy”, „medium” vagy „hard” lehet." }),
  seed: z
    .number({ error: "A mag egész szám kell legyen." })
    .int("A mag egész szám kell legyen.")
    .min(0, "A mag nem lehet negatív.")
    .max(0xffff_ffff, "A mag túl nagy.")
    .optional(),
});

export const parSchema = z.object({ content });

export const MAX_SEARCH = 80;
export const MAX_MATCH = 64;

const PAGE_PATTERN = /^[1-9][0-9]{0,5}$/;
const PAGE_MESSAGE = "Az oldalszám pozitív egész szám kell legyen.";

function positiveCount(message: string) {
  return z.string({ error: message }).regex(PAGE_PATTERN, message).transform(Number);
}

export function pageQuery(defaultSize: number, maxSize: number) {
  const sizeMessage = `Az oldalméret 1 és ${maxSize} közötti egész szám lehet.`;
  return z.object({
    page: positiveCount(PAGE_MESSAGE).default(1),
    pageSize: positiveCount(sizeMessage)
      .pipe(z.number().max(maxSize, sizeMessage))
      .default(defaultSize),
  });
}

const searchText = wellFormedText("A keresés")
  .max(MAX_SEARCH * 4, `A keresés legfeljebb ${MAX_SEARCH} karakter lehet.`)
  .transform((value) => value.replace(TITLE_BREAKS, " ").trim())
  .pipe(z.string().max(MAX_SEARCH, `A keresés legfeljebb ${MAX_SEARCH} karakter lehet.`))
  .default("");

export const MAP_PAGE_DEFAULT = 24;
export const MAP_PAGE_MAX = 60;

export const listMapsQuery = pageQuery(MAP_PAGE_DEFAULT, MAP_PAGE_MAX).extend({
  world: z
    .enum(MAP_WORLDS, { error: "A világ „all”, „sandbox” vagy „story” lehet." })
    .default("all"),
  scope: z
    .enum(MAP_SCOPES, { error: "A szűrő „all”, „mine” vagy „favorites” lehet." })
    .default("all"),
  q: searchText,
  sort: z
    .enum(MAP_SORTS, {
      error: "A rendezés „order”, „recent”, „size”, „gold” vagy „popular” lehet.",
    })
    .default("order"),
  level: z
    .enum(LEVEL_FILTERS, { error: "A nehézség „all”, „easy”, „medium” vagy „hard” lehet." })
    .default("all"),
});

export const matchMapsSchema = z.object({
  contents: z
    .array(content, { error: "A térképek listája szöveges elemekből álljon." })
    .max(MAX_MATCH, `Egyszerre legfeljebb ${MAX_MATCH} térkép kereshető.`),
});

export const RUN_PAGE_DEFAULT = 20;
export const RUN_PAGE_MAX = 100;

export const runsPageQuery = pageQuery(RUN_PAGE_DEFAULT, RUN_PAGE_MAX);

export const USER_PAGE_DEFAULT = 20;
export const USER_PAGE_MAX = 100;

export const adminUsersQuery = pageQuery(USER_PAGE_DEFAULT, USER_PAGE_MAX).extend({
  q: searchText,
});

export const PROGRAM_PAGE_DEFAULT = 20;
export const PROGRAM_PAGE_MAX = 100;
export const PROGRAM_SORTS = ["recent", "title"] as const;

export const programsQuery = pageQuery(PROGRAM_PAGE_DEFAULT, PROGRAM_PAGE_MAX).extend({
  q: searchText,
  sort: z
    .enum(PROGRAM_SORTS, { error: "A rendezés „recent” vagy „title” lehet." })
    .default("recent"),
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

const role = z.enum(["admin", "user"], { error: "A szerepkör „admin” vagy „user” lehet." });

export const roleSchema = z.object({ role });

export const newAccountSchema = credentialsSchema.extend({ role: role.default("user") });
