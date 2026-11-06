import { createRandom } from "./prng.ts";

export type GeneratorOptions = {
  maxLines: number;
  maxDepth: number;
  variables: readonly string[];
};

export const DEFAULT_GENERATOR_OPTIONS: GeneratorOptions = {
  maxLines: 30,
  maxDepth: 3,
  variables: ["a", "b", "arany", "fal", "n"],
};

export type GeneratedCase = { seed: number; program: string; map: string };

export function generateProgram(
  seed: number,
  options: GeneratorOptions = DEFAULT_GENERATOR_OPTIONS,
): GeneratedCase {
  const random = createRandom(seed);
  throw new Error(
    `A programgenerátor még nem készült el (seed: ${seed}, első véletlen szám: ${random.next()}, legfeljebb ${options.maxLines} sor).`,
  );
}
