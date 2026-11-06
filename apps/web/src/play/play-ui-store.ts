import { z } from "zod";
import { create } from "zustand";
import { readStorage, writeStorage } from "../lib/storage.ts";
import type { FogMode } from "../mine/tiles-model.ts";

export const TIP_IDS = [
  "blocked",
  "spacing",
  "emptyBlock",
  "empty",
  "firstRun",
  "goldLeft",
  "optimise",
] as const;
export type TipId = (typeof TIP_IDS)[number];

export const DRAWER_IDS = ["robot", "sense", "variables", "decision", "loop"] as const;
export type DrawerId = (typeof DRAWER_IDS)[number];

export type Pane = "stage" | "sheet";

const STORAGE_KEY = "minescript.play-ui";

const persistedSchema = z.object({
  fogMode: z.enum(["lamp", "full"]).catch("lamp"),
  dismissedTips: z.array(z.enum(TIP_IDS)).catch([]),
  hasRunOnce: z.boolean().catch(false),
});

type Persisted = z.infer<typeof persistedSchema>;

const DEFAULTS: Persisted = { fogMode: "lamp", dismissedTips: [], hasRunOnce: false };

function readPersisted(): Persisted {
  const stored = readStorage(STORAGE_KEY);
  if (stored === null) {
    return DEFAULTS;
  }
  try {
    const parsed = persistedSchema.safeParse(JSON.parse(stored));
    return parsed.success ? parsed.data : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

type PlayUiState = Persisted & {
  isFaultBarOpen: boolean;
  pane: Pane;
  openDrawer: DrawerId | null;
  setFogMode: (mode: FogMode) => void;
  toggleFog: () => void;
  dismissTip: (id: TipId) => void;
  markRun: () => void;
  setFaultBarOpen: (isOpen: boolean) => void;
  setPane: (pane: Pane) => void;
  setOpenDrawer: (id: DrawerId | null) => void;
  reset: () => void;
};

export const usePlayUi = create<PlayUiState>()((set, get) => {
  const persist = (patch: Partial<Persisted>) => {
    const next = { ...pick(get()), ...patch };
    writeStorage(STORAGE_KEY, JSON.stringify(next));
    set(patch);
  };
  return {
    ...readPersisted(),
    isFaultBarOpen: false,
    pane: "stage",
    openDrawer: null,
    setFogMode: (fogMode) => persist({ fogMode }),
    toggleFog: () => persist({ fogMode: get().fogMode === "lamp" ? "full" : "lamp" }),
    dismissTip: (id) => {
      if (id !== "blocked" && !get().dismissedTips.includes(id)) {
        persist({ dismissedTips: [...get().dismissedTips, id] });
      }
    },
    markRun: () => {
      if (!get().hasRunOnce) {
        persist({ hasRunOnce: true });
      }
    },
    setFaultBarOpen: (isFaultBarOpen) => set({ isFaultBarOpen }),
    setPane: (pane) => set({ pane }),
    setOpenDrawer: (openDrawer) => set({ openDrawer }),
    reset: () =>
      set({ ...readPersisted(), isFaultBarOpen: false, pane: "stage", openDrawer: null }),
  };
});

function pick(state: Persisted): Persisted {
  return {
    fogMode: state.fogMode,
    dismissedTips: state.dismissedTips,
    hasRunOnce: state.hasRunOnce,
  };
}
