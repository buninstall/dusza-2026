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
  const lastPath = useRef(pathname);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (lastPath.current === pathname) {
      return;
    }
    lastPath.current = pathname;
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
