import { useIsFetching } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { hu } from "../i18n/hu.ts";
import { LogoMark } from "../pixel/Logo.tsx";
import { useReadyHolds } from "./readiness.ts";
import "./LoadingCurtain.css";

const SHOW_DELAY_MS = 220;
const SETTLE_MS = 120;
const MAX_WAIT_MS = 8000;
const FADE_MS = 240;

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

  useEffect(() => {
    document.getElementById("boot-splash")?.remove();
  }, []);

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

  if (phase === "hidden") return null;
  return (
    <div className="curtain" data-phase={phase} aria-hidden={phase === "leaving"}>
      <output className="curtain-box">
        <LogoMark scale={4} lamp="pulse" />
        <span className="curtain-track" aria-hidden="true">
          <span className="curtain-cart" />
        </span>
        <span className="curtain-text">{hu.common.loading}</span>
      </output>
    </div>
  );
}
