import { useEffect, useRef, useState } from "react";
import { dirNames, hu } from "../i18n/hu.ts";
import type { Frame } from "./derive.ts";

export const ANNOUNCE_INTERVAL_MS = 1500;

export function announcementFor(frame: Frame | null): string {
  if (frame?.line == null) {
    return "";
  }
  return hu.play.announce(
    frame.line,
    frame.robot.pos.row + 1,
    frame.robot.pos.col + 1,
    dirNames[frame.robot.dir],
    frame.gold,
    frame.steps,
  );
}

type LiveAnnouncerProps = { frame: Frame | null; final?: string | undefined };

export function LiveAnnouncer({ frame, final }: LiveAnnouncerProps) {
  const [message, setMessage] = useState("");
  const lastAnnounced = useRef(0);
  const text = final ?? announcementFor(frame);

  useEffect(() => {
    const elapsed = Date.now() - lastAnnounced.current;
    const delay = final || elapsed >= ANNOUNCE_INTERVAL_MS ? 0 : ANNOUNCE_INTERVAL_MS - elapsed;
    const timer = window.setTimeout(() => {
      lastAnnounced.current = Date.now();
      setMessage(text);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [text, final]);

  return (
    <output aria-live="polite" className="visually-hidden">
      {message}
    </output>
  );
}
