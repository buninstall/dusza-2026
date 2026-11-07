import { cleanup, killingCases, loadVariant, MUTANTS } from "./mutation-core.ts";

const index = Number(process.argv[2] ?? "-1");
const mutant = index >= 0 ? MUTANTS[index] : null;
if (index >= 0 && !mutant) throw new Error(`Nincs ilyen mutáns: ${index}`);
try {
  const killed = killingCases(await loadVariant(mutant?.patches ?? []));
  console.log(`@@RESULT ${JSON.stringify({ killed })}`);
} finally {
  cleanup();
}
