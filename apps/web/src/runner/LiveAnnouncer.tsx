import { useEffect, useRef, useState } from "react";
import { dirNames, hu } from "../i18n/hu.ts";
import type { Frame } from "./derive.ts";

const ANNOUNCE_INTERVAL_MS = 1500;

export function announcementFor(frame: Frame): string {
  if (frame.line === null) {
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

export function LiveAnnouncer({ frame, final }: { frame: Frame | null; final?: string }) {
  const [message, setMessage] = useState("");
  const lastAnnounced = useRef(0);
  const pending = useRef<number | undefined>(undefined);
  const text = final ?? (frame ? announcementFor(frame) : "");

  useEffect(() => {
    window.clearTimeout(pending.current);
    const elapsed = Date.now() - lastAnnounced.current;
    const delay = final || elapsed >= ANNOUNCE_INTERVAL_MS ? 0 : ANNOUNCE_INTERVAL_MS - elapsed;
    pending.current = window.setTimeout(() => {
      lastAnnounced.current = Date.now();
      setMessage(text);
    }, delay);
    return () => window.clearTimeout(pending.current);
  }, [text, final]);

  return (
    <output aria-live="polite" className="sr-only">
      {message}
    </output>
  );
}
