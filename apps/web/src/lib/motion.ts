import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void): () => void {
  const media = window.matchMedia?.(QUERY);
  media?.addEventListener("change", onChange);
  return () => media?.removeEventListener("change", onChange);
}

function snapshot(): boolean {
  return window.matchMedia?.(QUERY).matches ?? false;
}

export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, snapshot, () => false);
}

export function playOnce(
  element: Element | null,
  keyframes: Keyframe[],
  options: KeyframeAnimationOptions,
): () => void {
  if (typeof element?.animate !== "function") {
    return () => undefined;
  }
  const animation = element.animate(keyframes, options);
  animation.finished.catch(() => undefined);
  return () => animation.cancel();
}
