import { type DraftMap, draftToText } from "./editor-state.ts";

export const HISTORY_LIMIT = 100;

export type History = {
  past: readonly DraftMap[];
  present: DraftMap;
  future: readonly DraftMap[];
  pending: DraftMap | null;
};

export type HistoryAction =
  | { type: "commit"; next: DraftMap }
  | { type: "preview"; next: DraftMap }
  | { type: "settle" }
  | { type: "cancel" }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "reset"; present: DraftMap };

export function initialHistory(present: DraftMap): History {
  return { past: [], present, future: [], pending: null };
}

function isSame(a: DraftMap, b: DraftMap): boolean {
  return a.dir === b.dir && draftToText(a) === draftToText(b);
}

function pushed(past: readonly DraftMap[], entry: DraftMap): DraftMap[] {
  return [...past, entry].slice(-HISTORY_LIMIT);
}

function settled(state: History): History {
  if (!state.pending) {
    return state;
  }
  if (isSame(state.pending, state.present)) {
    return { ...state, pending: null };
  }
  return {
    past: pushed(state.past, state.pending),
    present: state.present,
    future: [],
    pending: null,
  };
}

function stepBack(state: History): History {
  const previous = state.past[state.past.length - 1];
  if (!previous) {
    return state;
  }
  return {
    past: state.past.slice(0, -1),
    present: previous,
    future: [state.present, ...state.future],
    pending: null,
  };
}

function stepForward(state: History): History {
  const [next, ...rest] = state.future;
  if (!next) {
    return state;
  }
  return { past: pushed(state.past, state.present), present: next, future: rest, pending: null };
}

export function historyReducer(state: History, action: HistoryAction): History {
  switch (action.type) {
    case "commit":
      if (isSame(state.present, action.next)) {
        return state;
      }
      return {
        past: pushed(state.past, state.present),
        present: action.next,
        future: [],
        pending: null,
      };
    case "preview":
      return { ...state, present: action.next, pending: state.pending ?? state.present };
    case "settle":
      return settled(state);
    case "cancel":
      return state.pending ? { ...state, present: state.pending, pending: null } : state;
    case "undo":
      return stepBack(state);
    case "redo":
      return stepForward(state);
    case "reset":
      return initialHistory(action.present);
  }
}
