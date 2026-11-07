import { useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { hu } from "../i18n/hu.ts";

const TITLE_SETTLE_MS = 150;

function isFocusLost(): boolean {
  const active = document.activeElement;
  return active === null || active === document.body || !active.isConnected;
}

export function RouteFocus() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const isFirst = useRef(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false;
      return;
    }
    const timer = window.setTimeout(() => {
      if (isFocusLost()) {
        document.getElementById("main")?.focus({ preventScroll: true });
      }
      setMessage(hu.app.pageChanged(document.title));
    }, TITLE_SETTLE_MS);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  return (
    <output aria-live="polite" className="visually-hidden">
      {message}
    </output>
  );
}
