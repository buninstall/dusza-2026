import { RECIPE_NOTES, type RecipeNote } from "../i18n/hu-recipes.ts";

const FILES = import.meta.glob<string>("../../../../docs/receptek/**/*.{ms,txt}", {
  query: "?raw",
  import: "default",
  eager: true,
});

const ROOT = "../../../../docs/receptek/";

function note(key: string): RecipeNote {
  return RECIPE_NOTES[key] ?? { hint: "", insight: "" };
}

export type MapRecipe = {
  slug: string;
  file: string;
  mapFile: string;
  title: string;
  world: "story" | "sandbox";
  gold: number;
  total: number;
  steps: number;
  hint: string;
  insight: string;
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
    world: "story",
    gold: 2,
    total: 2,
    steps: 4,
    ...note("01-egyenes-folyoso"),
  },
  {
    slug: "01-egyenes-folyoso-ciklussal",
    file: "01-egyenes-folyoso-ciklussal.ms",
    mapFile: CORRIDOR_FILE,
    title: "1. Egyenes folyosó",
    world: "story",
    gold: 2,
    total: 2,
    steps: 56,
    ...note("01-egyenes-folyoso-ciklussal"),
  },
  {
    slug: "02-az-elso-kanyar",
    file: "02-az-elso-kanyar.ms",
    mapFile: "palyak/02-az-elso-kanyar.txt",
    title: "2. Az első kanyar",
    world: "story",
    gold: 2,
    total: 2,
    steps: 5,
    ...note("02-az-elso-kanyar"),
  },
  {
    slug: "03-kis-labirintus",
    file: "03-kis-labirintus.ms",
    mapFile: "palyak/03-kis-labirintus.txt",
    title: "3. Kis labirintus",
    world: "story",
    gold: 3,
    total: 3,
    steps: 24,
    ...note("03-kis-labirintus"),
  },
  {
    slug: "04-zsakutcak",
    file: "04-zsakutcak.ms",
    mapFile: "palyak/04-zsakutcak.txt",
    title: "4. Zsákutcák",
    world: "story",
    gold: 5,
    total: 5,
    steps: 31,
    ...note("04-zsakutcak"),
  },
  {
    slug: "05-kigyo",
    file: "05-kigyo.ms",
    mapFile: "palyak/05-kigyo.txt",
    title: "5. Kígyó",
    world: "story",
    gold: 3,
    total: 3,
    steps: 12,
    ...note("05-kigyo"),
  },
  {
    slug: "06-elerhetetlen-kincs",
    file: "06-elerhetetlen-kincs.ms",
    mapFile: "palyak/06-elerhetetlen-kincs.txt",
    title: "6. Elérhetetlen kincs",
    world: "story",
    gold: 2,
    total: 3,
    steps: 6,
    ...note("06-elerhetetlen-kincs"),
  },
  {
    slug: "07-aranymezo",
    file: "07-aranymezo.ms",
    mapFile: "palyak/07-aranymezo.txt",
    title: "7. Aranymező",
    world: "story",
    gold: 12,
    total: 12,
    steps: 29,
    ...note("07-aranymezo"),
  },
  {
    slug: "08-a-nagy-banya",
    file: "08-a-nagy-banya.ms",
    mapFile: "palyak/08-a-nagy-banya.txt",
    title: "8. A nagy bánya",
    world: "story",
    gold: 9,
    total: 9,
    steps: 84,
    ...note("08-a-nagy-banya"),
  },
  {
    slug: "09-kerulout",
    file: "09-kerulout.ms",
    mapFile: "palyak/09-kerulout.txt",
    title: "9. Kerülőút",
    world: "story",
    gold: 3,
    total: 3,
    steps: 12,
    ...note("09-kerulout"),
  },
  {
    slug: "10-oszlopcsarnok",
    file: "10-oszlopcsarnok.ms",
    mapFile: "palyak/10-oszlopcsarnok.txt",
    title: "10. Oszlopcsarnok",
    world: "story",
    gold: 13,
    total: 13,
    steps: 42,
    ...note("10-oszlopcsarnok"),
  },
  {
    slug: "11-geoda",
    file: "11-geoda.ms",
    mapFile: "palyak/11-geoda.txt",
    title: "11. Geoda",
    world: "story",
    gold: 3,
    total: 3,
    steps: 9,
    ...note("11-geoda"),
  },
  {
    slug: "12-kristalytukor",
    file: "12-kristalytukor.ms",
    mapFile: "palyak/12-kristalytukor.txt",
    title: "12. Kristálytükör",
    world: "story",
    gold: 3,
    total: 3,
    steps: 11,
    ...note("12-kristalytukor"),
  },
  {
    slug: "13-lila-erek",
    file: "13-lila-erek.ms",
    mapFile: "palyak/13-lila-erek.txt",
    title: "13. Lila erek",
    world: "story",
    gold: 5,
    total: 5,
    steps: 28,
    ...note("13-lila-erek"),
  },
  {
    slug: "13-lila-erek-vakon",
    file: "13-lila-erek-vakon.ms",
    mapFile: "palyak/13-lila-erek.txt",
    title: "13. Lila erek",
    world: "story",
    gold: 5,
    total: 5,
    steps: 198,
    ...note("13-lila-erek-vakon"),
  },
  {
    slug: "14-kilenc-kristaly",
    file: "14-kilenc-kristaly.ms",
    mapFile: "palyak/14-kilenc-kristaly.txt",
    title: "14. Kilenc kristály",
    world: "story",
    gold: 9,
    total: 9,
    steps: 26,
    ...note("14-kilenc-kristaly"),
  },
  {
    slug: "15-ametisztkatedralis",
    file: "15-ametisztkatedralis.ms",
    mapFile: "palyak/15-ametisztkatedralis.txt",
    title: "15. Ametisztkatedrális",
    world: "story",
    gold: 11,
    total: 11,
    steps: 42,
    ...note("15-ametisztkatedralis"),
  },
  {
    slug: "16-rozsdas-sinek",
    file: "16-rozsdas-sinek.ms",
    mapFile: "palyak/16-rozsdas-sinek.txt",
    title: "16. Rozsdás sínek",
    world: "story",
    gold: 3,
    total: 3,
    steps: 9,
    ...note("16-rozsdas-sinek"),
  },
  {
    slug: "17-iranytu",
    file: "17-iranytu.ms",
    mapFile: "palyak/17-iranytu.txt",
    title: "17. Iránytű",
    world: "story",
    gold: 5,
    total: 5,
    steps: 28,
    ...note("17-iranytu"),
  },
  {
    slug: "17-iranytu-vakon",
    file: "17-iranytu-vakon.ms",
    mapFile: "palyak/17-iranytu.txt",
    title: "17. Iránytű",
    world: "story",
    gold: 5,
    total: 5,
    steps: 496,
    ...note("17-iranytu-vakon"),
  },
  {
    slug: "18-vasercfejtes",
    file: "18-vasercfejtes.ms",
    mapFile: "palyak/18-vasercfejtes.txt",
    title: "18. Vasércfejtés",
    world: "story",
    gold: 10,
    total: 10,
    steps: 29,
    ...note("18-vasercfejtes"),
  },
  {
    slug: "19-a-voros-labirintus",
    file: "19-a-voros-labirintus.ms",
    mapFile: "palyak/19-a-voros-labirintus.txt",
    title: "19. A vörös labirintus",
    world: "story",
    gold: 10,
    total: 10,
    steps: 74,
    ...note("19-a-voros-labirintus"),
  },
  {
    slug: "20-kapuk",
    file: "20-kapuk.ms",
    mapFile: "palyak/20-kapuk.txt",
    title: "20. Kapuk",
    world: "story",
    gold: 11,
    total: 11,
    steps: 50,
    ...note("20-kapuk"),
  },
  {
    slug: "21-mohafeny",
    file: "21-mohafeny.ms",
    mapFile: "palyak/21-mohafeny.txt",
    title: "21. Mohafény",
    world: "story",
    gold: 3,
    total: 3,
    steps: 12,
    ...note("21-mohafeny"),
  },
  {
    slug: "22-szigetek",
    file: "22-szigetek.ms",
    mapFile: "palyak/22-szigetek.txt",
    title: "22. Szigetek",
    world: "story",
    gold: 8,
    total: 8,
    steps: 29,
    ...note("22-szigetek"),
  },
  {
    slug: "23-tukorto",
    file: "23-tukorto.ms",
    mapFile: "palyak/23-tukorto.txt",
    title: "23. Tükörtó",
    world: "story",
    gold: 8,
    total: 8,
    steps: 36,
    ...note("23-tukorto"),
  },
  {
    slug: "24-smaragdkigyo",
    file: "24-smaragdkigyo.ms",
    mapFile: "palyak/24-smaragdkigyo.txt",
    title: "24. Smaragdkígyó",
    world: "story",
    gold: 12,
    total: 12,
    steps: 42,
    ...note("24-smaragdkigyo"),
  },
  {
    slug: "24-smaragdkigyo-vakon",
    file: "24-smaragdkigyo-vakon.ms",
    mapFile: "palyak/24-smaragdkigyo.txt",
    title: "24. Smaragdkígyó",
    world: "story",
    gold: 12,
    total: 12,
    steps: 804,
    ...note("24-smaragdkigyo-vakon"),
  },
  {
    slug: "25-a-to-szeme",
    file: "25-a-to-szeme.ms",
    mapFile: "palyak/25-a-to-szeme.txt",
    title: "25. A tó szeme",
    world: "story",
    gold: 12,
    total: 13,
    steps: 59,
    ...note("25-a-to-szeme"),
  },
  {
    slug: "26-hamureteg",
    file: "26-hamureteg.ms",
    mapFile: "palyak/26-hamureteg.txt",
    title: "26. Hamuréteg",
    world: "story",
    gold: 3,
    total: 3,
    steps: 12,
    ...note("26-hamureteg"),
  },
  {
    slug: "27-lavafolyo",
    file: "27-lavafolyo.ms",
    mapFile: "palyak/27-lavafolyo.txt",
    title: "27. Lávafolyó",
    world: "story",
    gold: 8,
    total: 8,
    steps: 33,
    ...note("27-lavafolyo"),
  },
  {
    slug: "28-obszidiankapu",
    file: "28-obszidiankapu.ms",
    mapFile: "palyak/28-obszidiankapu.txt",
    title: "28. Obszidiánkapu",
    world: "story",
    gold: 12,
    total: 12,
    steps: 50,
    ...note("28-obszidiankapu"),
  },
  {
    slug: "29-izzo-tarnak",
    file: "29-izzo-tarnak.ms",
    mapFile: "palyak/29-izzo-tarnak.txt",
    title: "29. Izzó tárnák",
    world: "story",
    gold: 13,
    total: 13,
    steps: 65,
    ...note("29-izzo-tarnak"),
  },
  {
    slug: "30-a-sziv",
    file: "30-a-sziv.ms",
    mapFile: "palyak/30-a-sziv.txt",
    title: "30. A Szív",
    world: "story",
    gold: 13,
    total: 13,
    steps: 55,
    ...note("30-a-sziv"),
  },
  {
    slug: "homokozo-01-lepes-es-csakany",
    file: "homokozo/01-lepes-es-csakany.ms",
    mapFile: "homokozo/01-lepes-es-csakany.txt",
    title: "Lépés és csákány",
    world: "sandbox",
    gold: 2,
    total: 2,
    steps: 4,
    ...note("homokozo/01-lepes-es-csakany"),
  },
  {
    slug: "homokozo-02-negy-irany",
    file: "homokozo/02-negy-irany.ms",
    mapFile: "homokozo/02-negy-irany.txt",
    title: "Négy irány",
    world: "sandbox",
    gold: 4,
    total: 4,
    steps: 13,
    ...note("homokozo/02-negy-irany"),
  },
  {
    slug: "homokozo-03-tapogatozas",
    file: "homokozo/03-tapogatozas.ms",
    mapFile: "homokozo/03-tapogatozas.txt",
    title: "Tapogatózás",
    world: "sandbox",
    gold: 1,
    total: 1,
    steps: 11,
    ...note("homokozo/03-tapogatozas"),
  },
  {
    slug: "homokozo-04-menj-a-falig",
    file: "homokozo/04-menj-a-falig.ms",
    mapFile: "homokozo/04-menj-a-falig.txt",
    title: "Menj a falig",
    world: "sandbox",
    gold: 3,
    total: 3,
    steps: 71,
    ...note("homokozo/04-menj-a-falig"),
  },
  {
    slug: "homokozo-05-szamlalas",
    file: "homokozo/05-szamlalas.ms",
    mapFile: "homokozo/05-szamlalas.txt",
    title: "Számlálás",
    world: "sandbox",
    gold: 4,
    total: 4,
    steps: 34,
    ...note("homokozo/05-szamlalas"),
  },
  {
    slug: "homokozo-06-logikai-kapuk",
    file: "homokozo/06-logikai-kapuk.ms",
    mapFile: "homokozo/06-logikai-kapuk.txt",
    title: "Logikai kapuk",
    world: "sandbox",
    gold: 3,
    total: 3,
    steps: 93,
    ...note("homokozo/06-logikai-kapuk"),
  },
  {
    slug: "homokozo-07-jobb-kez-a-falon",
    file: "homokozo/07-jobb-kez-a-falon.ms",
    mapFile: "homokozo/07-jobb-kez-a-falon.txt",
    title: "Jobb kéz a falon",
    world: "sandbox",
    gold: 3,
    total: 3,
    steps: 444,
    ...note("homokozo/07-jobb-kez-a-falon"),
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
