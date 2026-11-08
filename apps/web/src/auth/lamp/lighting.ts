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

export type ShadeBox = { x: number; y: number; w: number; h: number };

export type ShadeTiles = {
  size: number;
  cols: number;
  memory: Float32Array;
  reveal: Float32Array;
};

export type ShadeOptions = {
  levels: number;
  tiles: ShadeTiles;
  box: ShadeBox;
  ambient: number;
  memoryTint: readonly [number, number, number];
  memoryLevel: number;
  memoryDensity: number;
  base: readonly [number, number, number];
  bounds?: { width: number; height: number };
};

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const NEAR_LAMP = 7;
const MIN_CONTRIBUTION = 0.015;
const RAY_STEP = 1.5;
const MAX_LEVEL = 1.35;
const UNKNOWN = 0;
const OPEN = 1;
const BLOCKED = 2;
const SHADOW_CACHE_SIZE = 24;

export function bayer(x: number, y: number): number {
  return BAYER[(y & 3) * 4 + (x & 3)] ?? 0.5;
}

export type Lighting = {
  compute: (lights: readonly Light[]) => void;
  shade: (albedo: Uint8ClampedArray, out: Uint8ClampedArray, options: ShadeOptions) => void;
  at: (x: number, y: number) => number;
  invalidate: () => void;
};

function sameLight(a: Light, b: Light): boolean {
  if (
    a.x !== b.x ||
    a.y !== b.y ||
    a.radius !== b.radius ||
    a.intensity !== b.intensity ||
    a.falloff !== b.falloff ||
    a.hasShadow !== b.hasShadow ||
    a.color[0] !== b.color[0] ||
    a.color[1] !== b.color[1] ||
    a.color[2] !== b.color[2]
  ) {
    return false;
  }
  const ca = a.cone;
  const cb = b.cone;
  if (!ca || !cb) {
    return ca === cb;
  }
  return ca.dx === cb.dx && ca.dy === cb.dy && ca.half === cb.half && ca.soft === cb.soft;
}

function sameLights(a: readonly Light[], b: readonly Light[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i += 1) {
    const left = a[i];
    const right = b[i];
    if (!left || !right || !sameLight(left, right)) {
      return false;
    }
  }
  return true;
}

export function createLighting(
  width: number,
  height: number,
  isSolid: (x: number, y: number) => boolean,
  penetration: number,
): Lighting {
  const blockWidth = Math.ceil(width / 2);
  const blockHeight = Math.ceil(height / 2);
  const light = new Float32Array(blockWidth * blockHeight * 3);
  const solid = new Uint8Array(width * height);
  const shadows = new Map<string, Uint8Array>();
  let computed: readonly Light[] | null = null;

  const solidAt = (x: number, y: number): boolean => {
    if (x < 0 || y < 0 || x >= width || y >= height) {
      return isSolid(x, y);
    }
    const index = y * width + x;
    const known = solid[index];
    if (known === OPEN) {
      return false;
    }
    if (known === BLOCKED) {
      return true;
    }
    const isWall = isSolid(x, y);
    solid[index] = isWall ? BLOCKED : OPEN;
    return isWall;
  };

  const shadowMask = (x: number, y: number): Uint8Array => {
    const key = `${x},${y}`;
    const hit = shadows.get(key);
    if (hit) {
      shadows.delete(key);
      shadows.set(key, hit);
      return hit;
    }
    const mask = new Uint8Array(blockWidth * blockHeight);
    shadows.set(key, mask);
    if (shadows.size > SHADOW_CACHE_SIZE) {
      const oldest = shadows.keys().next().value;
      if (oldest !== undefined) {
        shadows.delete(oldest);
      }
    }
    return mask;
  };

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
      if (solidAt(Math.floor(lx + sx * i), Math.floor(ly + sy * i))) {
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
    const mask = source.hasShadow !== false ? shadowMask(source.x, source.y) : null;
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
        if (mask) {
          const m = by * blockWidth + bx;
          let state = mask[m];
          if (state === UNKNOWN) {
            state = isBlocked(source.x, source.y, x, y) ? BLOCKED : OPEN;
            mask[m] = state;
          }
          if (state === BLOCKED) {
            continue;
          }
        }
        const k = (by * blockWidth + bx) * 3;
        light[k] = (light[k] ?? 0) + f * cr;
        light[k + 1] = (light[k + 1] ?? 0) + f * cg;
        light[k + 2] = (light[k + 2] ?? 0) + f * cb;
      }
    }
  };

  const compute = (lights: readonly Light[]) => {
    if (computed && sameLights(computed, lights)) {
      return;
    }
    computed = lights;
    light.fill(0);
    for (const source of lights) {
      addLight(source);
    }
  };

  const shade = (albedo: Uint8ClampedArray, out: Uint8ClampedArray, options: ShadeOptions) => {
    const [br, bg, bb] = options.base;
    const [mr, mg, mb] = options.memoryTint;
    const { levels, memoryLevel, memoryDensity, box, ambient } = options;
    const { size, memory, reveal } = options.tiles;
    const tileCols = options.tiles.cols;
    const rows = Math.min(height, options.bounds?.height ?? height);
    const cols = Math.min(width, options.bounds?.width ?? width);
    const boxRight = box.x + box.w;
    const boxBottom = box.y + box.h;
    for (let y = 0; y < rows; y += 1) {
      const row = (y >> 1) * blockWidth;
      const tileRow = Math.floor(y / size) * tileCols;
      const isBoxRow = y >= box.y && y < boxBottom;
      const isAmbientRow = y >= box.y - 1 && y <= boxBottom;
      const ditherRow = (y & 3) * 4;
      const hideRow = ((y + 1) & 3) * 4;
      for (let x = 0; x < cols; x += 1) {
        const i = (y * width + x) * 4;
        const tile = tileRow + Math.floor(x / size);
        const shown = isBoxRow && x >= box.x && x < boxRight ? 1 : (reveal[tile] ?? 0);
        if (shown <= (BAYER[hideRow + ((x + 2) & 3)] ?? 0.5)) {
          out[i] = br;
          out[i + 1] = bg;
          out[i + 2] = bb;
          out[i + 3] = 255;
          continue;
        }
        const k = (row + (x >> 1)) * 3;
        const amb = isAmbientRow && x >= box.x - 1 && x <= boxRight ? ambient : 0;
        const lr = (light[k] ?? 0) + amb;
        const lg = (light[k + 1] ?? 0) + amb * 0.82;
        const lb = (light[k + 2] ?? 0) + amb * 0.66;
        const lum = Math.max(lr, lg, lb);
        const b = BAYER[ditherRow + (x & 3)] ?? 0.5;
        const ar = albedo[i] ?? 0;
        const ag = albedo[i + 1] ?? 0;
        const ab = albedo[i + 2] ?? 0;
        let r = br;
        let g = bg;
        let bl = bb;
        const q = Math.min(MAX_LEVEL, Math.floor(lum * levels + b) / levels);
        if (q > 0) {
          const s = q / lum;
          r = Math.max(r, ar * lr * s);
          g = Math.max(g, ag * lg * s);
          bl = Math.max(bl, ab * lb * s);
        } else {
          const m = Math.min(memory[tile] ?? 0, reveal[tile] ?? 0);
          if (m > 0 && b < m * memoryDensity) {
            r = Math.max(r, ar * mr * memoryLevel);
            g = Math.max(g, ag * mg * memoryLevel);
            bl = Math.max(bl, ab * mb * memoryLevel);
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

  const invalidate = () => {
    solid.fill(UNKNOWN);
    shadows.clear();
    computed = null;
  };

  return { compute, shade, at, invalidate };
}
