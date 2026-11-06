import type { Pos } from "@minescript/engine";
import { type RefObject, useLayoutEffect, useRef } from "react";
import { usePrefersReducedMotion } from "../lib/motion.ts";
import { PixelSprite } from "../pixel/SpriteLayers.tsx";
import { TILE_SPRITES } from "../pixel/tiles.ts";

const FLIGHT_MS = 480;
const NUGGET_PX = 32;

type GoldFlightProps = {
  flight: { key: number; from: Pos } | null;
  rootRef: RefObject<HTMLElement | null>;
};

function centerOf(rect: DOMRect): string {
  const x = Math.round(rect.left + rect.width / 2 - NUGGET_PX / 2);
  const y = Math.round(rect.top + rect.height / 2 - NUGGET_PX / 2);
  return `translate(${x}px, ${y}px)`;
}

export function GoldFlight({ flight, rootRef }: GoldFlightProps) {
  const nuggetRef = useRef<HTMLDivElement>(null);
  const isReduced = usePrefersReducedMotion();
  const key = flight?.key ?? null;

  useLayoutEffect(() => {
    const root = rootRef.current;
    const nugget = nuggetRef.current;
    if (key === null || !flight || isReduced || !root || typeof nugget?.animate !== "function") {
      return;
    }
    const cell = root.querySelector(
      `[data-row="${flight.from.row}"][data-col="${flight.from.col}"]`,
    );
    const target = root.querySelector("[data-gold-target] .hud-cart-art");
    const from = cell?.getBoundingClientRect();
    const to = target?.getBoundingClientRect();
    if (!from || !to || to.width === 0 || from.width === 0) {
      return;
    }
    const animation = nugget.animate(
      [
        { transform: centerOf(from), opacity: 1 },
        { transform: centerOf(to), opacity: 1 },
      ],
      { duration: FLIGHT_MS, easing: "steps(8, end)" },
    );
    return () => animation.cancel();
  }, [key, flight, isReduced, rootRef]);

  return (
    <div ref={nuggetRef} aria-hidden="true" className="gold-flight">
      <PixelSprite sprite={TILE_SPRITES.nugget} />
    </div>
  );
}
