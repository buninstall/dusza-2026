export type PixelRows = readonly string[];

export type Palette = Readonly<Record<string, string>>;

export type SpriteLayer = { readonly tone: string; readonly path: string };

export type Sprite = {
  readonly width: number;
  readonly height: number;
  readonly layers: readonly SpriteLayer[];
};

export const TRANSPARENT = ".";

function assertRectangular(rows: PixelRows): number {
  const width = rows[0]?.length ?? 0;
  if (rows.some((row) => row.length !== width)) {
    throw new Error(`Pixel art rows must share one width (${width}).`);
  }
  return width;
}

export function pixelPath(rows: PixelRows, symbol: string, offsetX = 0, offsetY = 0): string {
  const segments: string[] = [];
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      if (row[x] !== symbol) {
        x += 1;
        continue;
      }
      const start = x;
      while (row[x] === symbol) {
        x += 1;
      }
      const run = x - start;
      segments.push(`M${start + offsetX} ${y + offsetY}h${run}v1h-${run}z`);
    }
  });
  return segments.join("");
}

export function sprite(rows: PixelRows, palette: Palette): Sprite {
  const width = assertRectangular(rows);
  const used = new Set(rows.join(""));
  for (const symbol of used) {
    if (symbol !== TRANSPARENT && palette[symbol] === undefined) {
      throw new Error(`Pixel art symbol "${symbol}" has no palette entry.`);
    }
  }
  const layers = Object.entries(palette)
    .filter(([symbol]) => used.has(symbol))
    .map(([symbol, tone]) => ({ tone, path: pixelPath(rows, symbol) }));
  return { width, height: rows.length, layers };
}

export function rotateClockwise(rows: PixelRows): string[] {
  const width = assertRectangular(rows);
  return Array.from({ length: width }, (_, x) =>
    rows
      .map((row) => row[x] ?? TRANSPARENT)
      .reverse()
      .join(""),
  );
}

export function rotateTimes(rows: PixelRows, quarterTurns: number): string[] {
  let result = [...rows];
  for (let turn = 0; turn < ((quarterTurns % 4) + 4) % 4; turn += 1) {
    result = rotateClockwise(result);
  }
  return result;
}

export function mirror(rows: PixelRows): string[] {
  return rows.map((row) => [...row].reverse().join(""));
}

export function toneFill(tone: string): string {
  return `var(--px-${tone})`;
}
