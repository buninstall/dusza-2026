import { z } from "zod";
import { create } from "zustand";
import { readStorage, writeStorage } from "../lib/storage.ts";
import { PLAY_MODES, type PlayMode } from "../maps/mode.ts";

export const TOUR_KEY = "minescript.tour";

export const TOUR_STEPS = ["board", "editor", "run", "watch", "mine", "stars"] as const;
export type TourStep = (typeof TOUR_STEPS)[number];

type Answer = "declined" | "done";

type TourData =
  | { status: "unasked" }
  | { status: Answer }
  | { status: "active"; mapId: number; step: number; mode?: PlayMode | undefined };

const stored = z.union([
  z.object({ status: z.enum(["declined", "done"]) }),
  z.object({
    status: z.literal("active"),
    mapId: z.number().int(),
    step: z.number().int(),
    mode: z.enum(PLAY_MODES).optional(),
  }),
]);

function load(): TourData {
  const raw = readStorage(TOUR_KEY);
  if (raw === null) {
    return { status: "unasked" };
  }
  try {
    const parsed = stored.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : { status: "unasked" };
  } catch {
    return { status: "unasked" };
  }
}

function save(data: TourData): TourData {
  if (data.status !== "unasked") {
    writeStorage(TOUR_KEY, JSON.stringify(data));
  }
  return data;
}

type TourState = {
  data: TourData;
  start: (mapId: number, mode?: PlayMode) => void;
  decline: () => void;
  advance: () => void;
  finish: () => void;
};

export const useTour = create<TourState>()((set, get) => ({
  data: load(),
  start: (mapId, mode) =>
    set({ data: save({ status: "active", mapId, step: 0, ...(mode ? { mode } : {}) }) }),
  decline: () => set({ data: save({ status: "declined" }) }),
  advance: () => {
    const { data } = get();
    if (data.status !== "active") {
      return;
    }
    const next = data.step + 1;
    set({
      data: save(next >= TOUR_STEPS.length ? { status: "done" } : { ...data, step: next }),
    });
  },
  finish: () => set({ data: save({ status: "done" }) }),
}));

export function activeStep(data: TourData, mapId: number): TourStep | null {
  if (data.status !== "active" || data.mapId !== mapId) {
    return null;
  }
  return TOUR_STEPS[data.step] ?? null;
}
