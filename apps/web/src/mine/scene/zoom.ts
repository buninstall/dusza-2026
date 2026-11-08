export const SCENE_ZOOM_LEVELS = [1, 1.25, 1.5, 2, 2.5, 3, 4] as const;
export const SCENE_ZOOM_MIN = 1;
export const SCENE_ZOOM_MAX = 4;
const EPSILON = 0.01;

export function clampSceneZoom(zoom: number): number {
  return Math.min(Math.max(zoom, SCENE_ZOOM_MIN), SCENE_ZOOM_MAX);
}

export function nextSceneZoom(zoom: number, direction: 1 | -1): number {
  const levels = direction > 0 ? SCENE_ZOOM_LEVELS : [...SCENE_ZOOM_LEVELS].reverse();
  const next = levels.find((level) =>
    direction > 0 ? level > zoom + EPSILON : level < zoom - EPSILON,
  );
  return next ?? (direction > 0 ? SCENE_ZOOM_MAX : SCENE_ZOOM_MIN);
}
