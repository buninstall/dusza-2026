import { type RefObject, useEffect } from "react";

type Modality = "keyboard" | "pointer";

let modality: Modality = "pointer";
let isTracking = false;

function track(): void {
  if (isTracking || typeof document === "undefined") {
    return;
  }
  isTracking = true;
  document.addEventListener(
    "keydown",
    (event) => {
      if (!event.metaKey && !event.altKey && !event.ctrlKey) {
        modality = "keyboard";
      }
    },
    true,
  );
  document.addEventListener(
    "pointerdown",
    () => {
      modality = "pointer";
    },
    true,
  );
}

export function useKeyboardFocusRing(hostRef: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    track();
    const host = hostRef.current;
    if (!host) {
      return;
    }
    const onFocusIn = () => {
      host.dataset.focusRing = String(modality === "keyboard");
    };
    const onFocusOut = (event: FocusEvent) => {
      if (!(event.relatedTarget instanceof Node && host.contains(event.relatedTarget))) {
        delete host.dataset.focusRing;
      }
    };
    host.addEventListener("focusin", onFocusIn);
    host.addEventListener("focusout", onFocusOut);
    return () => {
      host.removeEventListener("focusin", onFocusIn);
      host.removeEventListener("focusout", onFocusOut);
    };
  }, [hostRef]);
}
