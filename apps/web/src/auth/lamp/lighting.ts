export type Light = {
  x: number;
  y: number;
  radius: number;
  intensity: number;
  color: readonly [number, number, number];
  falloff: number;
  cone?: { dx: number; dy: number; half: number; soft: number };
  hasShadow?: boolean;
};

export type ShadeOptions = {
  levels: number;
  memory: (x: number, y: number) => number;
  memoryTint: readonly [number, number, number];
  memoryLevel: number;
  memoryDensity: number;
  ambient: (x: number, y: number) => number;
  reveal: (x: number, y: number) => number;
  base: readonly [number, number, number];
  bounds?: { width: number; height: number };
};

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const NEAR_LAMP = 7;
const MIN_CONTRIBUTION = 0.015;
const RAY_STEP = 1.5;
const MAX_LEVEL = 1.35;

export function bayer(x: number, y: number): number {
  return BAYER[(y & 3) * 4 + (x & 3)] ?? 0.5;
}

export type Lighting = {
  compute: (lights: readonly Light[]) => void;
  shade: (albedo: Uint8ClampedArray, out: Uint8ClampedArray, options: ShadeOptions) => void;
  at: (x: number, y: number) => number;
};

export function createLighting(
  width: number,
  height: number,
  isSolid: (x: number, y: number) => boolean,
  penetration: number,
): Lighting {
  const blockWidth = Math.ceil(width / 2);
  const blockHeight = Math.ceil(height / 2);
  const light = new Float32Array(blockWidth * blockHeight * 3);

  const isBlocked = (lx: number, ly: number, x: number, y: number): boolean => {
    const dx = x - lx;
    const dy = y - ly;
    const steps = Math.ceil(Math.hypot(dx, dy) / RAY_STEP);
    if (steps < 2) {
      return false;
    }
    const sx = dx / steps;
    const sy = dy / steps;
    let inside = 0;
    for (let i = 1; i < steps; i += 1) {
      if (isSolid(Math.floor(lx + sx * i), Math.floor(ly + sy * i))) {
        inside += RAY_STEP;
        if (inside > penetration) {
          return true;
        }
      }
    }
    return false;
  };

  const strength = (source: Light, dx: number, dy: number, distance: number): number => {
    let f = (1 - distance / source.radius) ** source.falloff;
    const cone = source.cone;
    if (cone) {
      if (distance <= NEAR_LAMP) {
        return f * 0.6 * source.intensity;
      }
      const cos = (dx * cone.dx + dy * cone.dy) / distance;
      const inner = Math.cos(cone.half);
      const outer = Math.cos(cone.half + cone.soft);
      if (cos < outer) {
        return 0;
      }
      if (cos < inner) {
        const t = (cos - outer) / (inner - outer);
        f *= t * t * (3 - 2 * t);
      }
    }
    return f * source.intensity;
  };

  const addLight = (source: Light) => {
    const r = source.radius;
    const x0 = Math.max(0, Math.floor((source.x - r) / 2));
    const x1 = Math.min(blockWidth - 1, Math.floor((source.x + r) / 2));
    const y0 = Math.max(0, Math.floor((source.y - r) / 2));
    const y1 = Math.min(blockHeight - 1, Math.floor((source.y + r) / 2));
    const [cr, cg, cb] = source.color;
    for (let by = y0; by <= y1; by += 1) {
      const y = by * 2 + 1;
      const dy = y - source.y;
      for (let bx = x0; bx <= x1; bx += 1) {
        const x = bx * 2 + 1;
        const dx = x - source.x;
        const d2 = dx * dx + dy * dy;
        if (d2 > r * r) {
          continue;
        }
        const f = strength(source, dx, dy, Math.sqrt(d2) + 0.0001);
        if (f < MIN_CONTRIBUTION) {
          continue;
        }
        if (source.hasShadow !== false && isBlocked(source.x, source.y, x, y)) {
          continue;
        }
        const k = (by * blockWidth + bx) * 3;
        light[k] = (light[k] ?? 0) + f * cr;
        light[k + 1] = (light[k + 1] ?? 0) + f * cg;
        light[k + 2] = (light[k + 2] ?? 0) + f * cb;
      }
    }
  };

  const compute = (lights: readonly Light[]) => {
    light.fill(0);
    for (const source of lights) {
      addLight(source);
    }
  };

  const shade = (albedo: Uint8ClampedArray, out: Uint8ClampedArray, options: ShadeOptions) => {
    const [br, bg, bb] = options.base;
    const [mr, mg, mb] = options.memoryTint;
    const rows = Math.min(height, options.bounds?.height ?? height);
    const cols = Math.min(width, options.bounds?.width ?? width);
    for (let y = 0; y < rows; y += 1) {
      const row = (y >> 1) * blockWidth;
      for (let x = 0; x < cols; x += 1) {
        const i = (y * width + x) * 4;
        const k = (row + (x >> 1)) * 3;
        const amb = options.ambient(x, y);
        const lr = (light[k] ?? 0) + amb;
        const lg = (light[k + 1] ?? 0) + amb * 0.82;
        const lb = (light[k + 2] ?? 0) + amb * 0.66;
        const lum = Math.max(lr, lg, lb);
        const b = bayer(x, y);
        const ar = albedo[i] ?? 0;
        const ag = albedo[i + 1] ?? 0;
        const ab = albedo[i + 2] ?? 0;
        let r = br;
        let g = bg;
        let bl = bb;
        const q = Math.min(MAX_LEVEL, Math.floor(lum * options.levels + b) / options.levels);
        const isHidden = options.reveal(x, y) <= bayer(x + 2, y + 1);
        if (isHidden) {
          out[i] = br;
          out[i + 1] = bg;
          out[i + 2] = bb;
          out[i + 3] = 255;
          continue;
        }
        if (q > 0) {
          const s = q / lum;
          r = Math.max(r, ar * lr * s);
          g = Math.max(g, ag * lg * s);
          bl = Math.max(bl, ab * lb * s);
        } else {
          const m = options.memory(x, y);
          if (m > 0 && b < m * options.memoryDensity) {
            r = Math.max(r, ar * mr * options.memoryLevel);
            g = Math.max(g, ag * mg * options.memoryLevel);
            bl = Math.max(bl, ab * mb * options.memoryLevel);
          }
        }
        out[i] = r;
        out[i + 1] = g;
        out[i + 2] = bl;
        out[i + 3] = 255;
      }
    }
  };

  const at = (x: number, y: number): number => {
    const bx = Math.max(0, Math.min(blockWidth - 1, x >> 1));
    const by = Math.max(0, Math.min(blockHeight - 1, y >> 1));
    const k = (by * blockWidth + bx) * 3;
    return Math.max(light[k] ?? 0, light[k + 1] ?? 0, light[k + 2] ?? 0);
  };

  return { compute, shade, at };
}
