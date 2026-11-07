import { codeFolding, foldGutter, foldKeymap, foldService } from "@codemirror/language";
import type { EditorState, Extension } from "@codemirror/state";
import { keymap } from "@codemirror/view";

function indentOf(text: string): number {
  return text.length - text.trimStart().length;
}

export function indentFoldRange(
  state: EditorState,
  lineStart: number,
): { from: number; to: number } | null {
  const line = state.doc.lineAt(lineStart);
  if (line.text.trim() === "") {
    return null;
  }
  const depth = indentOf(line.text);
  let end = line.to;
  for (let number = line.number + 1; number <= state.doc.lines; number += 1) {
    const next = state.doc.line(number);
    if (next.text.trim() === "") {
      continue;
    }
    if (indentOf(next.text) <= depth) {
      break;
    }
    end = next.to;
  }
  return end > line.to ? { from: line.to, to: end } : null;
}

export function mineScriptFolding(labels: { open: string; closed: string }): Extension {
  return [
    foldService.of(indentFoldRange),
    codeFolding({ placeholderText: "…" }),
    foldGutter({
      markerDOM: (isOpen) => {
        const marker = document.createElement("span");
        marker.className = "cm-fold-marker";
        marker.dataset.open = String(isOpen);
        marker.title = isOpen ? labels.open : labels.closed;
        marker.setAttribute("aria-hidden", "true");
        return marker;
      },
    }),
    keymap.of(foldKeymap),
  ];
}
