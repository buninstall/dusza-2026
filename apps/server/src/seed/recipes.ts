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
    file: "01-egyenes-folyoso-ciklussal.ms",
    title: "Recept – 1. Egyenes folyosó, ciklussal",
    mapIndex: CORRIDOR,
    source: walkAndMine,
    expected: { kind: "ok", gold: 2, steps: 56 },
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
