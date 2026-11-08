import type { SceneLayout } from "./layout.ts";
import { type Colors, hash } from "./scene-art.ts";

const IRON_TONES = [
  "iron-md",
  "iron-hi",
  "iron-lt",
  "iron",
  "steel",
  "steel-lo",
  "steel-dk",
  "tread",
  "tread-hi",
] as const;
const RUST_TONES = ["rust-dk", "rust", "rust-md", "rust-hi"] as const;
const BASE_SHARE = 0.04;
const LEVEL_SHARE = 0.07;
const MAX_LEVEL = 4;

function key(r: number, g: number, b: number): number {
  return (r << 16) | (g << 8) | b;
}

export function rustShare(level: number): number {
  const clamped = Math.min(Math.max(level, 0), MAX_LEVEL);
  return BASE_SHARE + clamped * LEVEL_SHARE;
}

export function readRustLevel(host: HTMLElement): number {
  const value = Number(host.closest<HTMLElement>("[data-rust]")?.dataset.rust ?? 0);
  return Number.isFinite(value) ? value : 0;
}

export function rustify(
  albedo: Uint8ClampedArray,
  layout: SceneLayout,
  colors: Colors,
  level: number,
): void {
  const iron = new Set(IRON_TONES.map((tone) => key(...colors.rgb(tone))));
  const rust = RUST_TONES.map((tone) => colors.rgb(tone));
  const share = rustShare(level);
  const top = Math.max(layout.cableY - 12, 0);
  for (let y = top; y < layout.H; y += 1) {
    for (let x = 0; x < layout.W; x += 1) {
      const i = (y * layout.W + x) * 4;
      if (!iron.has(key(albedo[i] ?? 0, albedo[i + 1] ?? 0, albedo[i + 2] ?? 0))) {
        continue;
      }
      const clump = hash(x >> 2, y >> 2, 31);
      if (clump > share * 2.2 || hash(x, y, 47) > 0.62) {
        continue;
      }
      const tone = rust[Math.floor(hash(x, y, 53) * rust.length)] ?? rust[0];
      if (tone) {
        albedo[i] = tone[0];
        albedo[i + 1] = tone[1];
        albedo[i + 2] = tone[2];
      }
    }
  }
}
