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

export const SHEET_SHARE = { min: 16, max: 64, initial: 30 } as const;

export const ZOOM_LEVELS = [1, 1.25, 1.5, 2, 2.5, 3, 4] as const;
export const ZOOM_MIN = 1;
export const ZOOM_MAX = 4;
const ZOOM_EPSILON = 0.01;

const persistedSchema = z.object({
  fogMode: z.enum(["lamp", "full"]).catch("lamp"),
  dismissedTips: z.array(z.enum(TIP_IDS)).catch([]),
  hasRunOnce: z.boolean().catch(false),
  isLogOpen: z.boolean().catch(false),
  sheetShare: z.number().min(SHEET_SHARE.min).max(SHEET_SHARE.max).nullable().catch(null),
});

type Persisted = z.infer<typeof persistedSchema>;

const DEFAULTS: Persisted = {
  fogMode: "lamp",
  dismissedTips: [],
  hasRunOnce: false,
  isLogOpen: false,
  sheetShare: null,
};

export function clampZoom(zoom: number): number {
  return Math.min(Math.max(zoom, ZOOM_MIN), ZOOM_MAX);
}

export function nextZoomLevel(zoom: number, direction: 1 | -1): number {
  const levels = direction > 0 ? ZOOM_LEVELS : [...ZOOM_LEVELS].reverse();
  const next = levels.find((level) =>
    direction > 0 ? level > zoom + ZOOM_EPSILON : level < zoom - ZOOM_EPSILON,
  );
  return next ?? (direction > 0 ? ZOOM_MAX : ZOOM_MIN);
}

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
  zoom: number;
  setFogMode: (mode: FogMode) => void;
  toggleLog: () => void;
  setZoom: (zoom: number) => void;
  shiftZoom: (direction: 1 | -1) => void;
  setSheetShare: (share: number | null) => void;
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
    zoom: 1,
    setFogMode: (fogMode) => persist({ fogMode }),
    toggleLog: () => persist({ isLogOpen: !get().isLogOpen }),
    setZoom: (zoom) => set({ zoom: clampZoom(zoom) }),
    shiftZoom: (direction) => set({ zoom: nextZoomLevel(get().zoom, direction) }),
    setSheetShare: (share) =>
      persist({
        sheetShare:
          share === null ? null : Math.min(Math.max(share, SHEET_SHARE.min), SHEET_SHARE.max),
      }),
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
      set({ ...readPersisted(), isFaultBarOpen: false, pane: "stage", openDrawer: null, zoom: 1 }),
  };
});

function pick(state: Persisted): Persisted {
  return {
    fogMode: state.fogMode,
    dismissedTips: state.dismissedTips,
    hasRunOnce: state.hasRunOnce,
    isLogOpen: state.isLogOpen,
    sheetShare: state.sheetShare,
  };
}
