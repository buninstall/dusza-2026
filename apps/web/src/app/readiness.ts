import { useSyncExternalStore } from "react";

const holds = new Set<symbol>();
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function holdReady(): () => void {
  const token = Symbol("hold");
  holds.add(token);
  emit();
  let isReleased = false;
  return () => {
    if (isReleased) return;
    isReleased = true;
    holds.delete(token);
    emit();
  };
}

export function releaseAfterPaint(release: () => void): void {
  requestAnimationFrame(() => requestAnimationFrame(release));
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useReadyHolds(): number {
  return useSyncExternalStore(
    subscribe,
    () => holds.size,
    () => 0,
  );
}
