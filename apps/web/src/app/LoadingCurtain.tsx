import { useIsFetching } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import "../pixel/pixel.css";
import { CURTAIN_ID } from "./curtain-html.ts";
import { useReadyHolds } from "./readiness.ts";
import "./LoadingCurtain.css";

const SHOW_DELAY_MS = 220;
const SETTLE_MS = 40;
const MAX_WAIT_MS = 8000;
const FADE_MS = 240;
const ENTRY_PATHS = new Set(["/login", "/register"]);

type Phase = "shown" | "leaving" | "hidden";

function useFontsReady(): boolean {
  const [isReady, setReady] = useState(() => typeof document === "undefined" || !document.fonts);
  useEffect(() => {
    if (isReady) return;
    let isAlive = true;
    void document.fonts.ready.then(() => {
      if (isAlive) setReady(true);
    });
    return () => {
      isAlive = false;
    };
  }, [isReady]);
  return isReady;
}

export function LoadingCurtain() {
  const isRouting = useRouterState({ select: (state) => state.status === "pending" });
  const path = useRouterState({ select: (state) => state.location.pathname });
  const lastPath = useRef(path);
  const waiting = useIsFetching({
    predicate: (query) => query.state.data === undefined && query.getObserversCount() > 0,
  });
  const holds = useReadyHolds();
  const isFontsReady = useFontsReady();
  const isWorking = isRouting || waiting > 0 || holds > 0 || !isFontsReady;
  const [hasGivenUp, setGivenUp] = useState(false);
  const isBusy = isWorking && !hasGivenUp;
  const [phase, setPhase] = useState<Phase>("shown");

  useEffect(() => {
    if (!isWorking) setGivenUp(false);
  }, [isWorking]);

  useLayoutEffect(() => {
    const curtain = document.getElementById(CURTAIN_ID);
    if (!curtain) return;
    curtain.dataset.phase = phase;
    if (phase === "shown") {
      curtain.removeAttribute("aria-hidden");
    } else {
      curtain.setAttribute("aria-hidden", "true");
    }
  }, [phase]);

  useLayoutEffect(() => {
    const from = lastPath.current;
    lastPath.current = path;
    if (from !== path && ENTRY_PATHS.has(from) && !ENTRY_PATHS.has(path)) {
      setGivenUp(false);
      setPhase("shown");
    }
  }, [path]);

  useEffect(() => {
    if (isBusy) {
      if (phase !== "hidden") {
        setPhase("shown");
        const limit = window.setTimeout(() => {
          setGivenUp(true);
          setPhase("leaving");
        }, MAX_WAIT_MS);
        return () => window.clearTimeout(limit);
      }
      const delay = window.setTimeout(() => setPhase("shown"), SHOW_DELAY_MS);
      return () => window.clearTimeout(delay);
    }
    if (phase !== "shown") return;
    let frame = 0;
    const settle = window.setTimeout(() => {
      frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(() => setPhase("leaving"));
      });
    }, SETTLE_MS);
    return () => {
      window.clearTimeout(settle);
      cancelAnimationFrame(frame);
    };
  }, [isBusy, phase]);

  useEffect(() => {
    if (phase !== "leaving") return;
    const done = window.setTimeout(() => setPhase("hidden"), FADE_MS);
    return () => window.clearTimeout(done);
  }, [phase]);

  return null;
}
