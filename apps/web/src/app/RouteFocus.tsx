import { useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { hu } from "../i18n/hu.ts";

const TITLE_SETTLE_MS = 150;
const FOCUS_WATCH_MS = 2000;
const FOCUS_POLL_MS = 100;

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
    const restoreFocus = () => {
      if (isFocusLost()) {
        document.getElementById("main")?.focus({ preventScroll: true });
      }
    };
    const timer = window.setTimeout(() => {
      restoreFocus();
      const heading = document.querySelector("h1")?.textContent?.trim() ?? "";
      setMessage(hu.app.pageChanged(heading || hu.app.name));
    }, TITLE_SETTLE_MS);
    const watch = window.setInterval(restoreFocus, FOCUS_POLL_MS);
    const stop = window.setTimeout(() => window.clearInterval(watch), FOCUS_WATCH_MS);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(watch);
      window.clearTimeout(stop);
    };
  }, [pathname]);

  return (
    <output aria-live="polite" className="visually-hidden">
      {message}
    </output>
  );
}
