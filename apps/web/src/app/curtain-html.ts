import { hu } from "../i18n/hu.ts";
import { LOGO_MARK } from "../pixel/logo-art.ts";
import { toneFill } from "../pixel/pixel-art.ts";

export const CURTAIN_ID = "curtain";

export const CURTAIN_SLOT = `<div id="${CURTAIN_ID}" class="curtain" data-phase="shown"></div>`;

const LOGO_SCALE = 4;
const PULSING_TONE = "lamp";
const PULSE_CLASS = "px-lamp-pulse";

const ESCAPES: Readonly<Record<string, string>> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
};

function escapeHtml(text: string): string {
  return text.replace(/[&<>"]/g, (char) => ESCAPES[char] ?? char);
}

function logoPaths(): string {
  return LOGO_MARK.layers
    .map((layer) => {
      const pulse = layer.tone === PULSING_TONE ? ` class="${PULSE_CLASS}"` : "";
      return `<path d="${layer.path}" style="fill:${toneFill(layer.tone)}"${pulse}></path>`;
    })
    .join("");
}

function curtainContent(): string {
  const viewBox = `0 0 ${LOGO_MARK.width} ${LOGO_MARK.height}`;
  return [
    '<output class="curtain-box">',
    `<span class="px-logo-mark" style="--logo-scale:${LOGO_SCALE}">`,
    `<svg aria-hidden="true" focusable="false" viewBox="${viewBox}" shape-rendering="crispEdges">`,
    logoPaths(),
    "</svg></span>",
    '<span class="curtain-track" aria-hidden="true"><span class="curtain-cart"></span></span>',
    `<span class="curtain-text">${escapeHtml(hu.common.loading)}</span>`,
    "</output>",
  ].join("");
}

export function fillCurtainSlot(html: string): string {
  if (!html.includes(CURTAIN_SLOT)) {
    throw new Error(`Az index.html-ből hiányzik a betöltő helye: ${CURTAIN_SLOT}`);
  }
  const filled = CURTAIN_SLOT.replace("></div>", `>${curtainContent()}</div>`);
  return html.replace(CURTAIN_SLOT, () => filled);
}
