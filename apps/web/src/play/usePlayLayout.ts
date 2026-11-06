import { useMediaQuery } from "../lib/useMediaQuery.ts";

export type PlayLayout = "cab" | "panes";

export function usePlayLayout(): PlayLayout {
  return useMediaQuery("(min-width: 64rem)", true) ? "cab" : "panes";
}
