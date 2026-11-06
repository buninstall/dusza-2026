export function firstRow<T>(rows: readonly T[]): T {
  const [row] = rows;
  if (row === undefined) {
    throw new Error("Az adatbázis nem adta vissza a várt sort.");
  }
  return row;
}
