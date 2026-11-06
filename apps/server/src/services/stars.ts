export type Score = { gold: number; steps: number };

export const MAX_STARS = 3;

export function starsFor(
  score: Score | null,
  reachableGold: number,
  parSteps: number | null,
): number | null {
  if (reachableGold <= 0) {
    return null;
  }
  if (!score || score.gold <= 0) {
    return 0;
  }
  if (score.gold < reachableGold) {
    return 1;
  }
  return parSteps !== null && score.steps <= parSteps ? MAX_STARS : 2;
}
