import type { Extension } from "@codemirror/state";
import { type EditorView, hoverTooltip, type Tooltip } from "@codemirror/view";
import type { Engine } from "@minescript/engine";

export function hoverSource(engine: Engine) {
  return (view: EditorView, pos: number): Tooltip | null => {
    const hover = engine.hover(view.state.doc.toString(), pos);
    if (!hover) {
      return null;
    }
    return {
      pos: hover.span.from,
      end: hover.span.to,
      above: false,
      create() {
        const dom = document.createElement("div");
        dom.className = "cm-ms-hover";
        dom.textContent = hover.contents;
        return { dom };
      },
    };
  };
}

const HOVER_DELAY_MS = 450;

export function mineScriptHover(engine: Engine): Extension {
  return hoverTooltip(hoverSource(engine), { hoverTime: HOVER_DELAY_MS, hideOnChange: true });
}
