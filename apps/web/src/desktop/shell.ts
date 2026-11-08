import { isDesktopShell } from "./platform.ts";

const TEXT_TARGET = "input, textarea, [contenteditable='true'], .cm-editor";

function allowsNativeMenu(target: EventTarget | null): boolean {
  if (target instanceof Element && target.closest(TEXT_TARGET)) {
    return true;
  }
  const selection = window.getSelection();
  return selection !== null && !selection.isCollapsed;
}

export function adoptDesktopShell(): void {
  if (!isDesktopShell(document.documentElement)) {
    return;
  }
  document.addEventListener("contextmenu", (event) => {
    if (!allowsNativeMenu(event.target)) {
      event.preventDefault();
    }
  });
}
