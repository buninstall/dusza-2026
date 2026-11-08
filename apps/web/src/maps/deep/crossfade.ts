export const FADE_MS = 220;
export const RESIZE_SETTLE_MS = 120;

export type Shot = HTMLCanvasElement;

export function snapshot(
  host: HTMLElement | null,
  layers: readonly HTMLCanvasElement[],
): Shot | null {
  const base = layers[0];
  if (!host || !base || base.width === 0 || base.height === 0) {
    return null;
  }
  const shot = document.createElement("canvas");
  shot.width = base.width;
  shot.height = base.height;
  const ctx = shot.getContext("2d");
  if (!ctx) {
    return null;
  }
  ctx.imageSmoothingEnabled = false;
  for (const layer of layers) {
    if (layer.width > 0 && layer.height > 0) {
      ctx.drawImage(layer, 0, 0, shot.width, shot.height);
    }
  }
  shot.className = "deep-canvas deep-shot";
  shot.style.cssText = base.style.cssText;
  shot.setAttribute("aria-hidden", "true");
  host.appendChild(shot);
  return shot;
}

export function stretch(shots: readonly Shot[]): void {
  for (const shot of shots) {
    shot.style.width = "100%";
  }
}

export function fadeOut(shots: readonly Shot[], isStatic: boolean): void {
  for (const shot of shots) {
    if (isStatic) {
      shot.remove();
      continue;
    }
    requestAnimationFrame(() => {
      shot.style.transition = `opacity ${FADE_MS}ms ease-out`;
      shot.style.opacity = "0";
      window.setTimeout(() => shot.remove(), FADE_MS + 40);
    });
  }
}
