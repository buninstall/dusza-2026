const PROBE_SIZE = 100;
const PROBE_STYLE = `position:absolute;top:-${PROBE_SIZE * 2}px;width:${PROBE_SIZE}px;height:${PROBE_SIZE}px;overflow:scroll;visibility:hidden`;

function scrollbarWidth(): number {
  const probe = document.createElement("div");
  probe.style.cssText = PROBE_STYLE;
  document.body.append(probe);
  const width = probe.offsetWidth - probe.clientWidth;
  probe.remove();
  return width;
}

function isLocked(root: HTMLElement): boolean {
  return getComputedStyle(root).overflowY === "hidden";
}

function missingGap(root: HTMLElement): number {
  if (!isLocked(root)) return 0;
  const reserved = window.innerWidth - root.clientWidth;
  return Math.max(0, scrollbarWidth() - reserved);
}

export function viewportWidth(): number {
  const root = document.documentElement;
  return root.clientWidth - (Number.parseFloat(root.style.paddingRight) || 0);
}

export function keepScrollbarGap(): () => void {
  const root = document.documentElement;
  const sync = () => {
    const gap = missingGap(root);
    const next = gap > 0 ? `${gap}px` : "";
    if (root.style.paddingRight !== next) root.style.paddingRight = next;
  };
  const observer = new MutationObserver(sync);
  observer.observe(root, { attributes: true, attributeFilter: ["style", "class"] });
  window.addEventListener("resize", sync);
  sync();
  return () => {
    observer.disconnect();
    window.removeEventListener("resize", sync);
    root.style.paddingRight = "";
  };
}
