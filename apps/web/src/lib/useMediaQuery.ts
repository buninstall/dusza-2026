import { useCallback, useSyncExternalStore } from "react";

export function useMediaQuery(query: string, fallback: boolean): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const media = window.matchMedia?.(query);
      media?.addEventListener("change", onChange);
      return () => media?.removeEventListener("change", onChange);
    },
    [query],
  );
  const snapshot = () => window.matchMedia?.(query).matches ?? fallback;
  return useSyncExternalStore(subscribe, snapshot, () => fallback);
}
