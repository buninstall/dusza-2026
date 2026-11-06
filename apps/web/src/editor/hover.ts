import type { Extension } from "@codemirror/state";
import { hoverTooltip } from "@codemirror/view";
import type { Engine } from "@minescript/engine";

export function mineScriptHover(engine: Engine): Extension {
  return hoverTooltip((view, pos) => {
    const hover = engine.hover(view.state.doc.toString(), pos);
    if (!hover) {
      return null;
    }
    return {
      pos: hover.span.from,
      end: hover.span.to,
      above: true,
      create() {
        const dom = document.createElement("div");
        dom.className = "cm-ms-hover";
        dom.textContent = hover.contents;
        return { dom };
      },
    };
  });
}
