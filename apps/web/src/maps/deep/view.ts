import { createLighting, type Light } from "../../auth/lamp/lighting.ts";
import { PANEL, ROCK, TIMBER, type World } from "./world.ts";

export type View = {
  ctx: CanvasRenderingContext2D;
  W: number;
  H: number;
  camY: number;
  lightAt: (x: number, y: number) => number;
  isVisible: (y: number, pad: number) => boolean;
  render: (lights: readonly Light[]) => void;
};

const AMBIENT = [0.44, 0.3, 1, 0.45, 0.36, 0.5, 0.5] as const;
const PAD_RATIO = 0.25;
const BASE = [6, 5, 4] as const;
const MEMORY_TINT = [1, 1, 1] as const;
const PENETRATION = 5;

export function createView(
  canvas: HTMLCanvasElement,
  world: World,
  scale: number,
  viewHeight: number,
): View | null {
  const W = world.W;
  const pad = Math.ceil((viewHeight / scale) * PAD_RATIO);
  const H = Math.min(world.H, Math.ceil(viewHeight / scale) + pad * 2 + 2);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  canvas.width = W;
  canvas.height = H;
  canvas.style.width = `${W * scale}px`;
  canvas.style.height = `${H * scale}px`;
  ctx.imageSmoothingEnabled = false;
  const frame = ctx.createImageData(W, H);
  let camY = 0;
  const isSolid = (x: number, y: number) => {
    const m = world.maskAt(x, y + camY);
    return m === ROCK || m === PANEL || m === TIMBER;
  };
  const lighting = createLighting(W, H, isSolid, PENETRATION);
  const view: View = {
    ctx,
    W,
    H,
    camY,
    lightAt: (x, y) => {
      const ly = Math.floor(y) - camY;
      return ly < 0 || ly >= H ? 0 : lighting.at(Math.floor(x), ly);
    },
    isVisible: (y, pad) => y >= camY - pad && y <= camY + H + pad,
    render: (lights) => {
      const scroll = window.scrollY;
      camY = Math.max(0, Math.min(world.H - H, Math.floor(scroll / scale) - pad));
      view.camY = camY;
      canvas.style.transform = `translate3d(0, ${camY * scale}px, 0)`;
      const local: Light[] = [];
      for (const light of lights) {
        if (light.y + light.radius < camY || light.y - light.radius > camY + H) continue;
        local.push({ ...light, y: light.y - camY });
      }
      lighting.compute(local);
      const slice = world.data.subarray(camY * W * 4, (camY + H) * W * 4);
      const mask = world.mask;
      lighting.shade(slice, frame.data, {
        levels: 5,
        memory: () => 0,
        memoryTint: MEMORY_TINT,
        memoryLevel: 0,
        memoryDensity: 0,
        ambient: (x, y) => AMBIENT[mask[(y + camY) * W + x] ?? ROCK] ?? 0,
        reveal: () => 1,
        base: BASE,
      });
      ctx.putImageData(frame, 0, 0);
    },
  };
  return view;
}
