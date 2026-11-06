import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

export const RECIPE_DIR = resolve(import.meta.dirname, "../docs/receptek");

export function recipePath(file: string): string {
  return join(RECIPE_DIR, file);
}

export function recipeBytes(file: string): Buffer {
  return readFileSync(recipePath(file));
}

export function recipeText(file: string): string {
  return recipeBytes(file).toString("utf8");
}

export type MapRecipe = {
  map: string;
  mapFile: string;
  program: string;
  library: string;
  gold: number;
  goldTotal: number;
  steps: number;
};

export const OPTIMAL_RECIPES: readonly MapRecipe[] = [
  {
    map: "1. Egyenes folyosó",
    mapFile: "palyak/01-egyenes-folyoso.txt",
    program: "01-egyenes-folyoso.ms",
    library: "Recept – 1. Egyenes folyosó",
    gold: 2,
    goldTotal: 2,
    steps: 4,
  },
  {
    map: "2. Az első kanyar",
    mapFile: "palyak/02-az-elso-kanyar.txt",
    program: "02-az-elso-kanyar.ms",
    library: "Recept – 2. Az első kanyar",
    gold: 2,
    goldTotal: 2,
    steps: 5,
  },
  {
    map: "3. Kis labirintus",
    mapFile: "palyak/03-kis-labirintus.txt",
    program: "03-kis-labirintus.ms",
    library: "Recept – 3. Kis labirintus",
    gold: 3,
    goldTotal: 3,
    steps: 24,
  },
  {
    map: "4. Zsákutcák",
    mapFile: "palyak/04-zsakutcak.txt",
    program: "04-zsakutcak.ms",
    library: "Recept – 4. Zsákutcák",
    gold: 5,
    goldTotal: 5,
    steps: 31,
  },
  {
    map: "5. Kígyó",
    mapFile: "palyak/05-kigyo.txt",
    program: "05-kigyo.ms",
    library: "Recept – 5. Kígyó",
    gold: 3,
    goldTotal: 3,
    steps: 12,
  },
  {
    map: "6. Elérhetetlen kincs",
    mapFile: "palyak/06-elerhetetlen-kincs.txt",
    program: "06-elerhetetlen-kincs.ms",
    library: "Recept – 6. Elérhetetlen kincs",
    gold: 2,
    goldTotal: 3,
    steps: 6,
  },
  {
    map: "7. Aranymező",
    mapFile: "palyak/07-aranymezo.txt",
    program: "07-aranymezo.ms",
    library: "Recept – 7. Aranymező",
    gold: 12,
    goldTotal: 12,
    steps: 29,
  },
  {
    map: "8. A nagy bánya",
    mapFile: "palyak/08-a-nagy-banya.txt",
    program: "08-a-nagy-banya.ms",
    library: "Recept – 8. A nagy bánya",
    gold: 9,
    goldTotal: 9,
    steps: 84,
  },
];

export const LOOP_RECIPE: MapRecipe = {
  map: "1. Egyenes folyosó",
  mapFile: "palyak/01-egyenes-folyoso.txt",
  program: "01-egyenes-folyoso-ciklussal.ms",
  library: "Recept – 1. Egyenes folyosó, ciklussal",
  gold: 2,
  goldTotal: 2,
  steps: 56,
};

export type ErrorRecipe = {
  file: string;
  library: string;
  code: string;
  line: number;
  steps: number;
};

export const ERROR_RECIPES: readonly ErrorRecipe[] = [
  {
    file: "hibak/e-bedrock-hit.ms",
    library: "Hibapróba – E_BEDROCK_HIT",
    code: "E_BEDROCK_HIT",
    line: 1,
    steps: 1,
  },
  {
    file: "hibak/e-no-gold.ms",
    library: "Hibapróba – E_NO_GOLD",
    code: "E_NO_GOLD",
    line: 1,
    steps: 1,
  },
  {
    file: "hibak/e-type-mismatch.ms",
    library: "Hibapróba – E_TYPE_MISMATCH",
    code: "E_TYPE_MISMATCH",
    line: 2,
    steps: 2,
  },
  {
    file: "hibak/e-uninitialized.ms",
    library: "Hibapróba – E_UNINITIALIZED",
    code: "E_UNINITIALIZED",
    line: 1,
    steps: 1,
  },
  {
    file: "hibak/e-non-bool-condition.ms",
    library: "Hibapróba – E_NON_BOOL_CONDITION",
    code: "E_NON_BOOL_CONDITION",
    line: 2,
    steps: 2,
  },
  {
    file: "hibak/e-bad-operand.ms",
    library: "Hibapróba – E_BAD_OPERAND",
    code: "E_BAD_OPERAND",
    line: 2,
    steps: 2,
  },
  {
    file: "hibak/e-bad-arg.ms",
    library: "Hibapróba – E_BAD_ARG",
    code: "E_BAD_ARG",
    line: 1,
    steps: 1,
  },
  {
    file: "hibak/e-int-overflow.ms",
    library: "Hibapróba – E_INT_OVERFLOW",
    code: "E_INT_OVERFLOW",
    line: 3,
    steps: 7,
  },
];

export const LIMIT_RECIPE: ErrorRecipe = {
  file: "hibak/instruction-count-limit-exceeded.ms",
  library: "Hibapróba – INSTRUCTION_COUNT_LIMIT_EXCEEDED",
  code: "INSTRUCTION_COUNT_LIMIT_EXCEEDED",
  line: 1,
  steps: 1000,
};

export const SYNTAX_RECIPE = {
  file: "hibak/szintaktikai-hibak.ms",
  library: "Hibapróba – szintaktikai hibák",
  lines: [1, 2, 3, 4],
} as const;

export type InvalidMap = { file: string; code: string; title: string };

export const INVALID_MAPS: readonly InvalidMap[] = [
  { file: "hibas-terkepek/ket-robot.txt", code: "MAP_MULTIPLE_ROBOTS", title: "Több robot" },
  { file: "hibas-terkepek/nincs-robot.txt", code: "MAP_NO_ROBOT", title: "Nincs robot" },
  {
    file: "hibas-terkepek/tul-nagy.txt",
    code: "MAP_DIM_RANGE",
    title: "Méret a tartományon kívül",
  },
  { file: "hibas-terkepek/hibas-fejlec.txt", code: "MAP_HEADER", title: "Hibás fejléc" },
  { file: "hibas-terkepek/ismeretlen-jel.txt", code: "MAP_BAD_SYMBOL", title: "Ismeretlen jel" },
  { file: "hibas-terkepek/rovid-sor.txt", code: "MAP_ROW_LENGTH", title: "Hibás sorhossz" },
  { file: "hibas-terkepek/ures.txt", code: "MAP_EMPTY", title: "Üres térképfájl" },
];
