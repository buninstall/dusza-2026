import { type RefObject, useEffect, useRef } from "react";
import { usePlayUi } from "./play-ui-store.ts";
import { usePlayback } from "./playback-store.ts";

export type PlayCommands = {
  run: () => void;
  save?: (() => void) | undefined;
  saveAs?: (() => void) | undefined;
  library?: (() => void) | undefined;
};

const NATIVE_KEYS =
  '[role="grid"], [role="slider"], [role="toolbar"], [role="radiogroup"], [role="menu"], [role="dialog"], input, textarea, [contenteditable="true"]';
const ACTIVATES = 'button, a[href], [role="button"], [role="radio"], [role="link"]';

function centerAction(): void {
  const playback = usePlayback.getState();
  if (playback.status === "playing") {
    playback.pause();
  } else if (playback.status === "finished") {
    playback.replay();
  } else {
    playback.play();
  }
}

const STAGE_KEYS: Readonly<Record<string, () => void>> = {
  ArrowLeft: () => usePlayback.getState().back(),
  ArrowRight: () => usePlayback.getState().step(),
  Home: () => usePlayback.getState().restart(),
  End: () => {
    const playback = usePlayback.getState();
    playback.seek(playback.result?.events.length ?? 0);
  },
  l: () => usePlayUi.getState().toggleFog(),
  L: () => usePlayUi.getState().toggleFog(),
  "+": () => usePlayback.getState().shiftSpeed(1),
  "=": () => usePlayback.getState().shiftSpeed(1),
  "-": () => usePlayback.getState().shiftSpeed(-1),
  "−": () => usePlayback.getState().shiftSpeed(-1),
};

function chord(event: KeyboardEvent, commands: PlayCommands): (() => void) | null {
  const isMod = event.ctrlKey || event.metaKey;
  const key = event.key.toLowerCase();
  if ((isMod && event.key === "Enter") || (event.key === "F5" && !event.shiftKey && !isMod)) {
    return commands.run;
  }
  if (event.key === "F5" && event.shiftKey) {
    return () => usePlayback.getState().stop();
  }
  if (isMod && key === "s") {
    return (event.shiftKey ? commands.saveAs : commands.save) ?? null;
  }
  if (isMod && key === "o") {
    return commands.library ?? null;
  }
  return null;
}

function stageKey(event: KeyboardEvent, stage: HTMLElement | null): (() => void) | null {
  if (event.ctrlKey || event.metaKey || event.altKey || !stage) {
    return null;
  }
  const target = event.target instanceof Element ? event.target : null;
  if (!target || !stage.contains(target) || target.closest(NATIVE_KEYS)) {
    return null;
  }
  if (event.key === " ") {
    return target.closest(ACTIVATES) ? null : centerAction;
  }
  return STAGE_KEYS[event.key] ?? null;
}

export function usePlayShortcuts(
  rootRef: RefObject<HTMLElement | null>,
  stageRef: RefObject<HTMLElement | null>,
  commands: PlayCommands,
): void {
  const latest = useRef(commands);
  latest.current = commands;
  useEffect(() => {
    const root = rootRef.current;
    if (!root) {
      return;
    }
    const handle = (event: KeyboardEvent) => {
      const isEditorRun =
        (event.ctrlKey || event.metaKey) &&
        event.key === "Enter" &&
        event.target instanceof Element &&
        event.target.closest(".cm-editor") !== null;
      if (event.defaultPrevented && !isEditorRun) {
        return;
      }
      const action = chord(event, latest.current) ?? stageKey(event, stageRef.current);
      if (action) {
        event.preventDefault();
        action();
      }
    };
    root.addEventListener("keydown", handle);
    return () => root.removeEventListener("keydown", handle);
  }, [rootRef, stageRef]);
}
