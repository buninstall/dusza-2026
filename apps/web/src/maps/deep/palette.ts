const DEEP_TONES = [
  "sky-0",
  "sky-1",
  "sky-2",
  "hill",
  "tree",
  "moon",
  "moon-hi",
  "grass",
  "grass-lo",
  "grass-dk",
  ...[0, 1, 2, 3, 4, 5, 6, 7].flatMap((k) => [
    `stratum-${k}-a`,
    `stratum-${k}-b`,
    `stratum-${k}-c`,
    `cavity-${k}-a`,
    `cavity-${k}-b`,
    `cavity-${k}-c`,
  ]),
  "root",
  "root-lo",
  "quartz",
  "fleck",
  "shade",
  "wood",
  "wood-grain",
  "wood-hi",
  "wood-lo",
  "sleeper",
  "plank",
  "plank-ink",
  "ballast",
  "ballast-hi",
  "rail",
  "rail-hi",
  "rubble-hi",
  "rubble",
  "rubble-lo",
  "water-top",
  "water",
  "water-mid",
  "water-deep",
  "spray",
  "spray-lo",
  "mined",
  "mined-hi",
  "shaft",
  "shaft-hi",
  "lantern-dim",
  "lantern-dim-hi",
  "lantern-off",
  "lantern-off-hi",
  "bat-lit",
  "bat-eye",
  "bat-dim",
  "bat-dim-eye",
  "bat",
  "smoke",
  "beacon",
  "beacon-off",
  "window",
  "window-lo",
  "house",
  "roof",
  "roof-lo",
  "truss",
  "truss-lo",
  "truss-dk",
  "cable",
  "worm",
  "worm-hi",
  "crystal-hi",
  "star",
  "star-dim",
  "rust",
  "rust-hi",
  "rust-lo",
  "iron",
  "iron-hi",
  "iron-lo",
  "iron-dk",
  "amethyst",
  "amethyst-hi",
  "amethyst-lo",
  "emerald",
  "emerald-hi",
  "emerald-lo",
  "moss",
  "moss-hi",
  "lake-top",
  "lake",
  "lake-mid",
  "lake-deep",
  "lava-top",
  "lava",
  "lava-mid",
  "lava-deep",
  "lava-crust",
  "fossil",
  "fossil-lo",
  "glass",
  "hematite",
  "vakond",
  "vakond-hi",
  "vakond-lo",
];

const PX_TONES = [
  "ore",
  "ore-hi",
  "ore-lo",
  "ore-edge",
  "glint",
  "steel-hi",
  "steel",
  "steel-lo",
  "steel-edge",
  "tread",
  "tread-hi",
  "visor",
  "lamp",
  "beam",
  "alert",
  "alert-ink",
  "gem",
  "gem-hi",
  "gem-lo",
];

export const TOPSOIL = 0;
export const CLAY = 1;
export const LIMESTONE = 2;
export const AMETHYST = 3;
export const IRON = 4;
export const EMERALD = 5;
export const OBSIDIAN = 6;
export const CORE = 7;
export const STRATUM_COUNT = 8;
export const TOPSOIL_DEPTH = 16;
export const DEFAULT_STRATA: readonly number[] = [
  TOPSOIL_DEPTH,
  190,
  400,
  640,
  900,
  1160,
  1420,
  Number.POSITIVE_INFINITY,
];

export function isMolten(k: number): boolean {
  return k >= OBSIDIAN;
}

export function readDeepPalette(element: Element): Readonly<Record<string, string>> {
  const style = getComputedStyle(element);
  const entries: [string, string][] = [
    ...DEEP_TONES.map((tone): [string, string] => [
      tone,
      style.getPropertyValue(`--deep-${tone}`).trim(),
    ]),
    ...PX_TONES.map((tone): [string, string] => [
      tone,
      style.getPropertyValue(`--px-${tone}`).trim(),
    ]),
  ];
  return Object.fromEntries(entries.filter(([, value]) => value.length > 0));
}

export function stratumTone(k: number, kind: "stratum" | "cavity", shade: number): string {
  return `${kind}-${k}-${shade === 0 ? "a" : shade === 1 ? "b" : "c"}`;
}
