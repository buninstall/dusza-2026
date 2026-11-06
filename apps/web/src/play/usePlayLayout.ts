import { useSyncExternalStore } from "react";

export type PlayLayout = "cab" | "panes";

const QUERY = "(min-width: 64rem)";

function subscribe(onChange: () => void): () => void {
  const media = window.matchMedia?.(QUERY);
  media?.addEventListener("change", onChange);
  return () => media?.removeEventListener("change", onChange);
}

function snapshot(): PlayLayout {
  return (window.matchMedia?.(QUERY).matches ?? true) ? "cab" : "panes";
}

export function usePlayLayout(): PlayLayout {
  return useSyncExternalStore(subscribe, snapshot, () => "cab");
}
