const MIN_CONTRIBUTION = 0.012;
const RAY_STEP = 1.5;
export const BAYER = Float32Array.from(
  [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5],
  (v) => (v + 0.5) / 16,
);

export type Rgb = readonly [number, number, number];

export type Cone = { dx: number; dy: number; half: number; soft: number };

export type Light = {
  x: number;
  y: number;
  r: number;
  falloff?: number;
  cone?: Cone;
  near?: number;
  shadow?: boolean;
  solid?: Solid;
};

export type DynamicLight = Light & { i: number; color: Rgb };

export type Solid = (x: number, y: number) => boolean;

export type Baked = {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  w: number;
  data: Float32Array;
};

export type BlockRect = { x0: number; y0: number; x1: number; y1: number };

export type LightField = {
  BW: number;
  BH: number;
  rgb: Float32Array;
  beam: Float32Array;
  bake: (light: Light) => Baked;
  addBaked: (baked: Baked, color: Rgb, intensity: number, clip?: BlockRect) => void;
  addDynamic: (light: DynamicLight, hazeWeight?: number, clip?: BlockRect) => void;
  addHaze: (baked: Baked, weight: number, clip?: BlockRect) => void;
  clear: () => void;
  clearBlocks: (clip: BlockRect) => void;
  at: (x: number, y: number) => number;
};

export function bayer(x: number, y: number): number {
  return BAYER[(y & 3) * 4 + (x & 3)] ?? 0.5;
}

export function smooth(t: number): number {
  const c = Math.min(Math.max(t, 0), 1);
  return c * c * (3 - 2 * c);
}

function coneFactor(light: Light, dx: number, dy: number, d: number): number {
  const cone = light.cone;
  if (!cone) {
    return 1;
  }
  const near = light.near ?? 7;
  if (d <= near) {
    return 0.55 + 0.45 * smooth(d / near);
  }
  const cos = (dx * cone.dx + dy * cone.dy) / d;
  const cosOut = Math.cos(cone.half + cone.soft);
  if (cos < cosOut) {
    return 0;
  }
  const cosIn = Math.cos(cone.half);
  return cos < cosIn ? smooth((cos - cosOut) / (cosIn - cosOut)) : 1;
}

export function strength(light: Light, x: number, y: number): number {
  const dx = x - light.x;
  const dy = y - light.y;
  const d2 = dx * dx + dy * dy;
  if (d2 > light.r * light.r) {
    return 0;
  }
  const d = Math.sqrt(d2) + 0.0001;
  return (1 - d / light.r) ** (light.falloff ?? 1.6) * coneFactor(light, dx, dy, d);
}

export function createLightField(
  W: number,
  H: number,
  isSolid: Solid,
  penetration = 4,
): LightField {
  const BW = Math.ceil(W / 2);
  const BH = Math.ceil(H / 2);
  const rgb = new Float32Array(BW * BH * 3);
  const beam = new Float32Array(BW * BH);

  const isBlocked = (light: Light, x: number, y: number): boolean => {
    const solid = light.solid ?? isSolid;
    const dx = x - light.x;
    const dy = y - light.y;
    const steps = Math.ceil(Math.hypot(dx, dy) / RAY_STEP);
    if (steps < 2) {
      return false;
    }
    const sx = dx / steps;
    const sy = dy / steps;
    let px = light.x;
    let py = light.y;
    let inside = 0;
    for (let i = 1; i < steps; i += 1) {
      px += sx;
      py += sy;
      if (solid(Math.floor(px), Math.floor(py))) {
        inside += RAY_STEP;
        if (inside > penetration) {
          return true;
        }
      }
    }
    return false;
  };

  const box = (light: Light) => ({
    x0: Math.max(0, Math.floor((light.x - light.r) / 2)),
    x1: Math.min(BW - 1, Math.ceil((light.x + light.r) / 2)),
    y0: Math.max(0, Math.floor((light.y - light.r) / 2)),
    y1: Math.min(BH - 1, Math.ceil((light.y + light.r) / 2)),
  });

  const sample = (light: Light, bx: number, by: number): number => {
    const x = bx * 2 + 1;
    const y = by * 2 + 1;
    const f = strength(light, x, y);
    if (f < MIN_CONTRIBUTION) {
      return 0;
    }
    return light.shadow !== false && isBlocked(light, x, y) ? 0 : f;
  };

  const bake = (light: Light): Baked => {
    const b = box(light);
    const w = Math.max(b.x1 - b.x0 + 1, 0);
    const h = Math.max(b.y1 - b.y0 + 1, 0);
    const data = new Float32Array(w * h);
    for (let by = b.y0; by <= b.y1; by += 1) {
      for (let bx = b.x0; bx <= b.x1; bx += 1) {
        data[(by - b.y0) * w + (bx - b.x0)] = sample(light, bx, by);
      }
    }
    return { ...b, w, data };
  };

  const addBaked = (baked: Baked, color: Rgb, intensity: number, clip?: BlockRect): void => {
    if (intensity <= 0) {
      return;
    }
    const [cr, cg, cb] = color;
    const x0 = clip ? Math.max(baked.x0, clip.x0) : baked.x0;
    const x1 = clip ? Math.min(baked.x1, clip.x1) : baked.x1;
    const y0 = clip ? Math.max(baked.y0, clip.y0) : baked.y0;
    const y1 = clip ? Math.min(baked.y1, clip.y1) : baked.y1;
    const data = baked.data;
    for (let by = y0; by <= y1; by += 1) {
      let k = (by * BW + x0) * 3;
      let j = (by - baked.y0) * baked.w + (x0 - baked.x0);
      for (let bx = x0; bx <= x1; bx += 1) {
        const f = (data[j] as number) * intensity;
        if (f > 0) {
          rgb[k] = (rgb[k] as number) + f * cr;
          rgb[k + 1] = (rgb[k + 1] as number) + f * cg;
          rgb[k + 2] = (rgb[k + 2] as number) + f * cb;
        }
        k += 3;
        j += 1;
      }
    }
  };

  const addDynamic = (light: DynamicLight, hazeWeight = 0, clip?: BlockRect): void => {
    const b = box(light);
    const x0 = clip ? Math.max(b.x0, clip.x0) : b.x0;
    const x1 = clip ? Math.min(b.x1, clip.x1) : b.x1;
    const y0 = clip ? Math.max(b.y0, clip.y0) : b.y0;
    const y1 = clip ? Math.min(b.y1, clip.y1) : b.y1;
    const [cr, cg, cb] = light.color;
    for (let by = y0; by <= y1; by += 1) {
      for (let bx = x0; bx <= x1; bx += 1) {
        const f = sample(light, bx, by) * light.i;
        if (f <= 0) {
          continue;
        }
        const k = (by * BW + bx) * 3;
        rgb[k] = (rgb[k] ?? 0) + f * cr;
        rgb[k + 1] = (rgb[k + 1] ?? 0) + f * cg;
        rgb[k + 2] = (rgb[k + 2] ?? 0) + f * cb;
        if (hazeWeight > 0) {
          beam[by * BW + bx] = (beam[by * BW + bx] ?? 0) + f * hazeWeight;
        }
      }
    }
  };

  const addHaze = (baked: Baked, weight: number, clip?: BlockRect): void => {
    if (weight <= 0) {
      return;
    }
    const x0 = clip ? Math.max(baked.x0, clip.x0) : baked.x0;
    const x1 = clip ? Math.min(baked.x1, clip.x1) : baked.x1;
    const y0 = clip ? Math.max(baked.y0, clip.y0) : baked.y0;
    const y1 = clip ? Math.min(baked.y1, clip.y1) : baked.y1;
    for (let by = y0; by <= y1; by += 1) {
      let j = (by - baked.y0) * baked.w + (x0 - baked.x0);
      let k = by * BW + x0;
      for (let bx = x0; bx <= x1; bx += 1) {
        const f = baked.data[j] as number;
        if (f > 0) {
          beam[k] = (beam[k] as number) + f * weight;
        }
        j += 1;
        k += 1;
      }
    }
  };

  const clear = (): void => {
    rgb.fill(0);
    beam.fill(0);
  };

  const clearBlocks = (clip: BlockRect): void => {
    const x0 = Math.max(clip.x0, 0);
    const x1 = Math.min(clip.x1, BW - 1);
    for (let by = Math.max(clip.y0, 0); by <= Math.min(clip.y1, BH - 1); by += 1) {
      rgb.fill(0, (by * BW + x0) * 3, (by * BW + x1 + 1) * 3);
      beam.fill(0, by * BW + x0, by * BW + x1 + 1);
    }
  };

  const at = (x: number, y: number): number => {
    const bx = Math.max(0, Math.min(BW - 1, x >> 1));
    const by = Math.max(0, Math.min(BH - 1, y >> 1));
    const k = (by * BW + bx) * 3;
    return Math.max(rgb[k] ?? 0, rgb[k + 1] ?? 0, rgb[k + 2] ?? 0);
  };

  return { BW, BH, rgb, beam, bake, addBaked, addDynamic, addHaze, clear, clearBlocks, at };
}
