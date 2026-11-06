const FILES = import.meta.glob<string>("../../../../docs/receptek/**/*.{ms,txt}", {
  query: "?raw",
  import: "default",
  eager: true,
});

const ROOT = "../../../../docs/receptek/";

export type MapRecipe = {
  slug: string;
  file: string;
  mapFile: string;
  title: string;
  gold: number;
  total: number;
  steps: number;
  hint: string;
};

export type ErrorRecipe = {
  slug: string;
  file: string;
  code: string | null;
  lines: readonly number[];
  steps: number;
  hint: string;
};

export type BadMap = { file: string; code: string };

export const CORRIDOR_FILE = "palyak/01-egyenes-folyoso.txt";

export const MAP_RECIPES: readonly MapRecipe[] = [
  {
    slug: "01-egyenes-folyoso",
    file: "01-egyenes-folyoso.ms",
    mapFile: CORRIDOR_FILE,
    title: "1. Egyenes folyosó",
    gold: 2,
    total: 2,
    steps: 4,
    hint: "többmezős lépés, bányászás",
  },
  {
    slug: "01-egyenes-folyoso-ciklussal",
    file: "01-egyenes-folyoso-ciklussal.ms",
    mapFile: CORRIDOR_FILE,
    title: "1. Egyenes folyosó",
    gold: 2,
    total: 2,
    steps: 56,
    hint: "a feladatkiírás példaprogramja: `while`, `if`/`else`, `isThere`, `print`",
  },
  {
    slug: "02-az-elso-kanyar",
    file: "02-az-elso-kanyar.ms",
    mapFile: "palyak/02-az-elso-kanyar.txt",
    title: "2. Az első kanyar",
    gold: 2,
    total: 2,
    steps: 5,
    hint: "fordulás jobbra (`turn by 3`)",
  },
  {
    slug: "03-kis-labirintus",
    file: "03-kis-labirintus.ms",
    mapFile: "palyak/03-kis-labirintus.txt",
    title: "3. Kis labirintus",
    gold: 3,
    total: 3,
    steps: 24,
    hint: "kanyargós járatok, visszafordulás",
  },
  {
    slug: "04-zsakutcak",
    file: "04-zsakutcak.ms",
    mapFile: "palyak/04-zsakutcak.txt",
    title: "4. Zsákutcák",
    gold: 5,
    total: 5,
    steps: 31,
    hint: "zsákutcák ki-be járása",
  },
  {
    slug: "05-kigyo",
    file: "05-kigyo.ms",
    mapFile: "palyak/05-kigyo.txt",
    title: "5. Kígyó",
    gold: 3,
    total: 3,
    steps: 12,
    hint: "hosszú egyenesek",
  },
  {
    slug: "06-elerhetetlen-kincs",
    file: "06-elerhetetlen-kincs.ms",
    mapFile: "palyak/06-elerhetetlen-kincs.txt",
    title: "6. Elérhetetlen kincs",
    gold: 2,
    total: 3,
    steps: 6,
    hint: "a harmadik arany falakkal körülzárt, nem érhető el",
  },
  {
    slug: "07-aranymezo",
    file: "07-aranymezo.ms",
    mapFile: "palyak/07-aranymezo.txt",
    title: "7. Aranymező",
    gold: 12,
    total: 12,
    steps: 29,
    hint: "sok bányászás nyílt terepen",
  },
  {
    slug: "08-a-nagy-banya",
    file: "08-a-nagy-banya.ms",
    mapFile: "palyak/08-a-nagy-banya.txt",
    title: "8. A nagy bánya",
    gold: 9,
    total: 9,
    steps: 84,
    hint: "15×15-ös térkép, köd, hosszú futás",
  },
];

export const ERROR_RECIPES: readonly ErrorRecipe[] = [
  {
    slug: "e-bedrock-hit",
    file: "hibak/e-bedrock-hit.ms",
    code: "E_BEDROCK_HIT",
    lines: [1],
    steps: 1,
    hint: "a robot a térkép szélén megáll",
  },
  {
    slug: "e-no-gold",
    file: "hibak/e-no-gold.ms",
    code: "E_NO_GOLD",
    lines: [1],
    steps: 1,
    hint: "bányászás arany nélkül",
  },
  {
    slug: "e-type-mismatch",
    file: "hibak/e-type-mismatch.ms",
    code: "E_TYPE_MISMATCH",
    lines: [2],
    steps: 2,
    hint: "a változó típusa rögzül",
  },
  {
    slug: "e-uninitialized",
    file: "hibak/e-uninitialized.ms",
    code: "E_UNINITIALIZED",
    lines: [1],
    steps: 1,
    hint: "értékadás nélküli változó",
  },
  {
    slug: "e-non-bool-condition",
    file: "hibak/e-non-bool-condition.ms",
    code: "E_NON_BOOL_CONDITION",
    lines: [2],
    steps: 2,
    hint: "egész szám feltételként",
  },
  {
    slug: "e-bad-operand",
    file: "hibak/e-bad-operand.ms",
    code: "E_BAD_OPERAND",
    lines: [2],
    steps: 2,
    hint: "logikai értékhez szám hozzáadása",
  },
  {
    slug: "e-bad-arg",
    file: "hibak/e-bad-arg.ms",
    code: "E_BAD_ARG",
    lines: [1],
    steps: 1,
    hint: "`turn by true`",
  },
  {
    slug: "e-int-overflow",
    file: "hibak/e-int-overflow.ms",
    code: "E_INT_OVERFLOW",
    lines: [3],
    steps: 7,
    hint: "túl nagy egész szám",
  },
  {
    slug: "instruction-count-limit-exceeded",
    file: "hibak/instruction-count-limit-exceeded.ms",
    code: "INSTRUCTION_COUNT_LIMIT_EXCEEDED",
    lines: [1],
    steps: 1000,
    hint: "végtelen ciklus: a robot pörög, majd az 1000. sor után leáll",
  },
  {
    slug: "szintaktikai-hibak",
    file: "hibak/szintaktikai-hibak.ms",
    code: null,
    lines: [1, 2, 3, 4],
    steps: 0,
    hint: "nem futtatható: dupla szóköz, ismeretlen utasítás, túl nagy szám, tabulátor",
  },
];

export const BAD_MAPS: readonly BadMap[] = [
  { file: "hibas-terkepek/ket-robot.txt", code: "MAP_MULTIPLE_ROBOTS" },
  { file: "hibas-terkepek/nincs-robot.txt", code: "MAP_NO_ROBOT" },
  { file: "hibas-terkepek/tul-nagy.txt", code: "MAP_DIM_RANGE" },
  { file: "hibas-terkepek/hibas-fejlec.txt", code: "MAP_HEADER" },
  { file: "hibas-terkepek/ismeretlen-jel.txt", code: "MAP_BAD_SYMBOL" },
  { file: "hibas-terkepek/rovid-sor.txt", code: "MAP_ROW_LENGTH" },
  { file: "hibas-terkepek/ures.txt", code: "MAP_EMPTY" },
];

export function recipeText(file: string): string {
  const text = FILES[`${ROOT}${file}`];
  if (text === undefined) {
    throw new Error(`Hiányzó receptfájl: ${file}`);
  }
  return text;
}

export function baseName(file: string): string {
  return file.slice(file.lastIndexOf("/") + 1);
}

export function normaliseMap(content: string): string {
  return `${content.replaceAll("\r\n", "\n").trimEnd()}\n`;
}

export type ProgramRecipe = { slug: string; file: string; mapFile: string; title: string };

export function findRecipe(slug: string): ProgramRecipe | undefined {
  const map = MAP_RECIPES.find((recipe) => recipe.slug === slug);
  if (map) {
    return map;
  }
  const error = ERROR_RECIPES.find((recipe) => recipe.slug === slug);
  return error
    ? { slug: error.slug, file: error.file, mapFile: CORRIDOR_FILE, title: baseName(error.file) }
    : undefined;
}
