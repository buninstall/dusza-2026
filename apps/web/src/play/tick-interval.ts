const MS_PER_SECOND = 1000;

export function tickInterval(speed: number): number {
  return MS_PER_SECOND / speed;
}
