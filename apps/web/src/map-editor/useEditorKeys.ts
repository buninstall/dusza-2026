import { type RefObject, useEffect, useRef } from "react";
import type { KeyChord } from "./useCanvasTools.ts";

export type ZoomStep = 1 | -1 | 0;

export type EditorKeys = {
  undo: () => void;
  redo: () => void;
  save: () => void;
  zoom: (step: ZoomStep) => void;
  letter: (chord: KeyChord) => boolean;
};

const TEXT_TARGETS = "input:not([type='radio']):not([type='checkbox']), textarea";

const ZOOM_KEYS: Readonly<Record<string, ZoomStep>> = { "+": 1, "=": 1, "-": -1, "0": 0 };

function isTextTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || target.closest(TEXT_TARGETS) !== null)
  );
}

function plainKey(event: KeyboardEvent, keys: EditorKeys): boolean {
  if (isTextTarget(event.target)) {
    return false;
  }
  const zoomStep = ZOOM_KEYS[event.key];
  if (zoomStep !== undefined) {
    keys.zoom(zoomStep);
    return true;
  }
  return keys.letter(event);
}

export function useEditorKeys(rootRef: RefObject<HTMLElement | null>, keys: EditorKeys): void {
  const latest = useRef(keys);
  latest.current = keys;
  useEffect(() => {
    const root = rootRef.current;
    if (!root) {
      return;
    }
    const handle = (event: KeyboardEvent) => {
      if (event.altKey) {
        return;
      }
      if (!(event.ctrlKey || event.metaKey)) {
        if (plainKey(event, latest.current)) {
          event.preventDefault();
        }
        return;
      }
      const key = event.key.toLowerCase();
      if (key === "s") {
        event.preventDefault();
        latest.current.save();
        return;
      }
      if (isTextTarget(event.target)) {
        return;
      }
      if (key === "z") {
        event.preventDefault();
        (event.shiftKey ? latest.current.redo : latest.current.undo)();
      } else if (key === "y") {
        event.preventDefault();
        latest.current.redo();
      }
    };
    root.addEventListener("keydown", handle);
    return () => root.removeEventListener("keydown", handle);
  }, [rootRef]);
}
