import { useEffect, useState } from "react";
import { z } from "zod";
import { hu } from "../i18n/hu.ts";
import { readStorage, writeStorage } from "../lib/storage.ts";

export type LinkedProgram = { id: number; title: string; savedSource: string };

export type ProgramDraft = { source: string; linked: LinkedProgram | null };

const draftSchema = z.object({
  source: z.string(),
  linked: z.object({ id: z.number().int(), title: z.string(), savedSource: z.string() }).nullable(),
});

export function draftKey(mapId: number): string {
  return `minescript.program.${mapId}`;
}

export function readDraft(mapId: number): ProgramDraft {
  const stored = readStorage(draftKey(mapId));
  if (stored === null) {
    return { source: hu.play.starterProgram, linked: null };
  }
  try {
    const parsed = draftSchema.safeParse(JSON.parse(stored));
    return parsed.success ? parsed.data : { source: stored, linked: null };
  } catch {
    return { source: stored, linked: null };
  }
}

export function isModified(draft: ProgramDraft): boolean {
  return draft.linked !== null && draft.linked.savedSource !== draft.source;
}

export function useProgramDraft(mapId: number, initial?: ProgramDraft) {
  const [draft, setDraft] = useState(() => initial ?? readDraft(mapId));
  useEffect(() => writeStorage(draftKey(mapId), JSON.stringify(draft)), [mapId, draft]);
  return [draft, setDraft] as const;
}
