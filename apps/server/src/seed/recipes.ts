import best01 from "../../../../docs/receptek/01-egyenes-folyoso.ms" with { type: "text" };
import walkAndMine from "../../../../docs/receptek/01-egyenes-folyoso-ciklussal.ms" with {
  type: "text",
};
import best02 from "../../../../docs/receptek/02-az-elso-kanyar.ms" with { type: "text" };
import best03 from "../../../../docs/receptek/03-kis-labirintus.ms" with { type: "text" };
import best04 from "../../../../docs/receptek/04-zsakutcak.ms" with { type: "text" };
import best05 from "../../../../docs/receptek/05-kigyo.ms" with { type: "text" };
import best06 from "../../../../docs/receptek/06-elerhetetlen-kincs.ms" with { type: "text" };
import best07 from "../../../../docs/receptek/07-aranymezo.ms" with { type: "text" };
import best08 from "../../../../docs/receptek/08-a-nagy-banya.ms" with { type: "text" };
import best09 from "../../../../docs/receptek/09-kerulout.ms" with { type: "text" };
import best10 from "../../../../docs/receptek/10-oszlopcsarnok.ms" with { type: "text" };
import best11 from "../../../../docs/receptek/11-geoda.ms" with { type: "text" };
import best12 from "../../../../docs/receptek/12-kristalytukor.ms" with { type: "text" };
import best13 from "../../../../docs/receptek/13-lila-erek.ms" with { type: "text" };
import blind13 from "../../../../docs/receptek/13-lila-erek-vakon.ms" with { type: "text" };
import best14 from "../../../../docs/receptek/14-kilenc-kristaly.ms" with { type: "text" };
import best15 from "../../../../docs/receptek/15-ametisztkatedralis.ms" with { type: "text" };
import best16 from "../../../../docs/receptek/16-rozsdas-sinek.ms" with { type: "text" };
import best17 from "../../../../docs/receptek/17-iranytu.ms" with { type: "text" };
import blind17 from "../../../../docs/receptek/17-iranytu-vakon.ms" with { type: "text" };
import best18 from "../../../../docs/receptek/18-vasercfejtes.ms" with { type: "text" };
import best19 from "../../../../docs/receptek/19-a-voros-labirintus.ms" with { type: "text" };
import best20 from "../../../../docs/receptek/20-kapuk.ms" with { type: "text" };
import best21 from "../../../../docs/receptek/21-mohafeny.ms" with { type: "text" };
import best22 from "../../../../docs/receptek/22-szigetek.ms" with { type: "text" };
import best23 from "../../../../docs/receptek/23-tukorto.ms" with { type: "text" };
import best24 from "../../../../docs/receptek/24-smaragdkigyo.ms" with { type: "text" };
import blind24 from "../../../../docs/receptek/24-smaragdkigyo-vakon.ms" with { type: "text" };
import best25 from "../../../../docs/receptek/25-a-to-szeme.ms" with { type: "text" };
import best26 from "../../../../docs/receptek/26-hamureteg.ms" with { type: "text" };
import best27 from "../../../../docs/receptek/27-lavafolyo.ms" with { type: "text" };
import best28 from "../../../../docs/receptek/28-obszidiankapu.ms" with { type: "text" };
import best29 from "../../../../docs/receptek/29-izzo-tarnak.ms" with { type: "text" };
import best30 from "../../../../docs/receptek/30-a-sziv.ms" with { type: "text" };
import errorEBadArg from "../../../../docs/receptek/hibak/e-bad-arg.ms" with { type: "text" };
import errorEBadOperand from "../../../../docs/receptek/hibak/e-bad-operand.ms" with {
  type: "text",
};
import errorEBedrockHit from "../../../../docs/receptek/hibak/e-bedrock-hit.ms" with {
  type: "text",
};
import errorEIntOverflow from "../../../../docs/receptek/hibak/e-int-overflow.ms" with {
  type: "text",
};
import errorENoGold from "../../../../docs/receptek/hibak/e-no-gold.ms" with { type: "text" };
import errorENonBoolCondition from "../../../../docs/receptek/hibak/e-non-bool-condition.ms" with {
  type: "text",
};
import errorETypeMismatch from "../../../../docs/receptek/hibak/e-type-mismatch.ms" with {
  type: "text",
};
import errorEUninitialized from "../../../../docs/receptek/hibak/e-uninitialized.ms" with {
  type: "text",
};
import errorInstructionCountLimitExceeded from "../../../../docs/receptek/hibak/instruction-count-limit-exceeded.ms" with {
  type: "text",
};
import syntaxErrors from "../../../../docs/receptek/hibak/szintaktikai-hibak.ms" with {
  type: "text",
};

export type RecipeOutcome =
  | { kind: "ok"; gold: number; steps: number }
  | { kind: "runtimeError"; code: string; line: number; steps: number }
  | { kind: "syntaxError"; lines: readonly number[] };

export type Recipe = {
  file: string;
  title: string;
  mapIndex: number;
  source: string;
  expected: RecipeOutcome;
};

const CORRIDOR = 0;

export const RECIPES: readonly Recipe[] = [
  {
    file: "01-egyenes-folyoso.ms",
    title: "Recept – 1. Egyenes folyosó",
    mapIndex: 0,
    source: best01,
    expected: { kind: "ok", gold: 2, steps: 4 },
  },
  {
    file: "02-az-elso-kanyar.ms",
    title: "Recept – 2. Az első kanyar",
    mapIndex: 1,
    source: best02,
    expected: { kind: "ok", gold: 2, steps: 5 },
  },
  {
    file: "03-kis-labirintus.ms",
    title: "Recept – 3. Kis labirintus",
    mapIndex: 2,
    source: best03,
    expected: { kind: "ok", gold: 3, steps: 24 },
  },
  {
    file: "04-zsakutcak.ms",
    title: "Recept – 4. Zsákutcák",
    mapIndex: 3,
    source: best04,
    expected: { kind: "ok", gold: 5, steps: 31 },
  },
  {
    file: "05-kigyo.ms",
    title: "Recept – 5. Kígyó",
    mapIndex: 4,
    source: best05,
    expected: { kind: "ok", gold: 3, steps: 12 },
  },
  {
    file: "06-elerhetetlen-kincs.ms",
    title: "Recept – 6. Elérhetetlen kincs",
    mapIndex: 5,
    source: best06,
    expected: { kind: "ok", gold: 2, steps: 6 },
  },
  {
    file: "07-aranymezo.ms",
    title: "Recept – 7. Aranymező",
    mapIndex: 6,
    source: best07,
    expected: { kind: "ok", gold: 12, steps: 29 },
  },
  {
    file: "08-a-nagy-banya.ms",
    title: "Recept – 8. A nagy bánya",
    mapIndex: 7,
    source: best08,
    expected: { kind: "ok", gold: 9, steps: 84 },
  },
  {
    file: "09-kerulout.ms",
    title: "Recept – 9. Kerülőút",
    mapIndex: 8,
    source: best09,
    expected: { kind: "ok", gold: 3, steps: 12 },
  },
  {
    file: "10-oszlopcsarnok.ms",
    title: "Recept – 10. Oszlopcsarnok",
    mapIndex: 9,
    source: best10,
    expected: { kind: "ok", gold: 13, steps: 42 },
  },
  {
    file: "11-geoda.ms",
    title: "Recept – 11. Geoda",
    mapIndex: 10,
    source: best11,
    expected: { kind: "ok", gold: 3, steps: 9 },
  },
  {
    file: "12-kristalytukor.ms",
    title: "Recept – 12. Kristálytükör",
    mapIndex: 11,
    source: best12,
    expected: { kind: "ok", gold: 3, steps: 11 },
  },
  {
    file: "13-lila-erek.ms",
    title: "Recept – 13. Lila erek",
    mapIndex: 12,
    source: best13,
    expected: { kind: "ok", gold: 5, steps: 28 },
  },
  {
    file: "14-kilenc-kristaly.ms",
    title: "Recept – 14. Kilenc kristály",
    mapIndex: 13,
    source: best14,
    expected: { kind: "ok", gold: 9, steps: 26 },
  },
  {
    file: "15-ametisztkatedralis.ms",
    title: "Recept – 15. Ametisztkatedrális",
    mapIndex: 14,
    source: best15,
    expected: { kind: "ok", gold: 11, steps: 42 },
  },
  {
    file: "16-rozsdas-sinek.ms",
    title: "Recept – 16. Rozsdás sínek",
    mapIndex: 15,
    source: best16,
    expected: { kind: "ok", gold: 3, steps: 9 },
  },
  {
    file: "17-iranytu.ms",
    title: "Recept – 17. Iránytű",
    mapIndex: 16,
    source: best17,
    expected: { kind: "ok", gold: 5, steps: 28 },
  },
  {
    file: "18-vasercfejtes.ms",
    title: "Recept – 18. Vasércfejtés",
    mapIndex: 17,
    source: best18,
    expected: { kind: "ok", gold: 10, steps: 29 },
  },
  {
    file: "19-a-voros-labirintus.ms",
    title: "Recept – 19. A vörös labirintus",
    mapIndex: 18,
    source: best19,
    expected: { kind: "ok", gold: 10, steps: 74 },
  },
  {
    file: "20-kapuk.ms",
    title: "Recept – 20. Kapuk",
    mapIndex: 19,
    source: best20,
    expected: { kind: "ok", gold: 11, steps: 50 },
  },
  {
    file: "21-mohafeny.ms",
    title: "Recept – 21. Mohafény",
    mapIndex: 20,
    source: best21,
    expected: { kind: "ok", gold: 3, steps: 12 },
  },
  {
    file: "22-szigetek.ms",
    title: "Recept – 22. Szigetek",
    mapIndex: 21,
    source: best22,
    expected: { kind: "ok", gold: 8, steps: 29 },
  },
  {
    file: "23-tukorto.ms",
    title: "Recept – 23. Tükörtó",
    mapIndex: 22,
    source: best23,
    expected: { kind: "ok", gold: 8, steps: 36 },
  },
  {
    file: "24-smaragdkigyo.ms",
    title: "Recept – 24. Smaragdkígyó",
    mapIndex: 23,
    source: best24,
    expected: { kind: "ok", gold: 12, steps: 42 },
  },
  {
    file: "25-a-to-szeme.ms",
    title: "Recept – 25. A tó szeme",
    mapIndex: 24,
    source: best25,
    expected: { kind: "ok", gold: 12, steps: 59 },
  },
  {
    file: "26-hamureteg.ms",
    title: "Recept – 26. Hamuréteg",
    mapIndex: 25,
    source: best26,
    expected: { kind: "ok", gold: 3, steps: 12 },
  },
  {
    file: "27-lavafolyo.ms",
    title: "Recept – 27. Lávafolyó",
    mapIndex: 26,
    source: best27,
    expected: { kind: "ok", gold: 8, steps: 33 },
  },
  {
    file: "28-obszidiankapu.ms",
    title: "Recept – 28. Obszidiánkapu",
    mapIndex: 27,
    source: best28,
    expected: { kind: "ok", gold: 12, steps: 50 },
  },
  {
    file: "29-izzo-tarnak.ms",
    title: "Recept – 29. Izzó tárnák",
    mapIndex: 28,
    source: best29,
    expected: { kind: "ok", gold: 13, steps: 65 },
  },
  {
    file: "30-a-sziv.ms",
    title: "Recept – 30. A Szív",
    mapIndex: 29,
    source: best30,
    expected: { kind: "ok", gold: 13, steps: 55 },
  },
  {
    file: "01-egyenes-folyoso-ciklussal.ms",
    title: "Recept – 1. Egyenes folyosó, ciklussal",
    mapIndex: CORRIDOR,
    source: walkAndMine,
    expected: { kind: "ok", gold: 2, steps: 56 },
  },
  {
    file: "13-lila-erek-vakon.ms",
    title: "Recept – 13. Lila erek, vakon",
    mapIndex: 12,
    source: blind13,
    expected: { kind: "ok", gold: 5, steps: 198 },
  },
  {
    file: "17-iranytu-vakon.ms",
    title: "Recept – 17. Iránytű, vakon",
    mapIndex: 16,
    source: blind17,
    expected: { kind: "ok", gold: 5, steps: 496 },
  },
  {
    file: "24-smaragdkigyo-vakon.ms",
    title: "Recept – 24. Smaragdkígyó, vakon",
    mapIndex: 23,
    source: blind24,
    expected: { kind: "ok", gold: 12, steps: 804 },
  },
  {
    file: "hibak/e-bedrock-hit.ms",
    title: "Hibapróba – E_BEDROCK_HIT",
    mapIndex: CORRIDOR,
    source: errorEBedrockHit,
    expected: { kind: "runtimeError", code: "E_BEDROCK_HIT", line: 1, steps: 1 },
  },
  {
    file: "hibak/e-no-gold.ms",
    title: "Hibapróba – E_NO_GOLD",
    mapIndex: CORRIDOR,
    source: errorENoGold,
    expected: { kind: "runtimeError", code: "E_NO_GOLD", line: 1, steps: 1 },
  },
  {
    file: "hibak/e-type-mismatch.ms",
    title: "Hibapróba – E_TYPE_MISMATCH",
    mapIndex: CORRIDOR,
    source: errorETypeMismatch,
    expected: { kind: "runtimeError", code: "E_TYPE_MISMATCH", line: 2, steps: 2 },
  },
  {
    file: "hibak/e-uninitialized.ms",
    title: "Hibapróba – E_UNINITIALIZED",
    mapIndex: CORRIDOR,
    source: errorEUninitialized,
    expected: { kind: "runtimeError", code: "E_UNINITIALIZED", line: 1, steps: 1 },
  },
  {
    file: "hibak/e-non-bool-condition.ms",
    title: "Hibapróba – E_NON_BOOL_CONDITION",
    mapIndex: CORRIDOR,
    source: errorENonBoolCondition,
    expected: { kind: "runtimeError", code: "E_NON_BOOL_CONDITION", line: 2, steps: 2 },
  },
  {
    file: "hibak/e-bad-operand.ms",
    title: "Hibapróba – E_BAD_OPERAND",
    mapIndex: CORRIDOR,
    source: errorEBadOperand,
    expected: { kind: "runtimeError", code: "E_BAD_OPERAND", line: 2, steps: 2 },
  },
  {
    file: "hibak/e-bad-arg.ms",
    title: "Hibapróba – E_BAD_ARG",
    mapIndex: CORRIDOR,
    source: errorEBadArg,
    expected: { kind: "runtimeError", code: "E_BAD_ARG", line: 1, steps: 1 },
  },
  {
    file: "hibak/e-int-overflow.ms",
    title: "Hibapróba – E_INT_OVERFLOW",
    mapIndex: CORRIDOR,
    source: errorEIntOverflow,
    expected: { kind: "runtimeError", code: "E_INT_OVERFLOW", line: 3, steps: 7 },
  },
  {
    file: "hibak/instruction-count-limit-exceeded.ms",
    title: "Hibapróba – INSTRUCTION_COUNT_LIMIT_EXCEEDED",
    mapIndex: CORRIDOR,
    source: errorInstructionCountLimitExceeded,
    expected: {
      kind: "runtimeError",
      code: "INSTRUCTION_COUNT_LIMIT_EXCEEDED",
      line: 1,
      steps: 1000,
    },
  },
  {
    file: "hibak/szintaktikai-hibak.ms",
    title: "Hibapróba – szintaktikai hibák",
    mapIndex: CORRIDOR,
    source: syntaxErrors,
    expected: { kind: "syntaxError", lines: [1, 2, 3, 4] },
  },
];
