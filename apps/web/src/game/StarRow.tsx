import type { CSSProperties } from "react";
import { hu } from "../i18n/hu.ts";
import { PixelIcon } from "../pixel/PixelIcon.tsx";
import "./StarRow.css";

export const MAX_STARS = 3;

const STAR_SLOTS = Array.from({ length: MAX_STARS }, (_, index) => index);

type StarRowProps = {
  stars: number;
  size?: "sm" | "md" | "lg";
  previous?: number;
  isAnimated?: boolean;
};

export function StarRow({
  stars,
  size = "md",
  previous = stars,
  isAnimated = false,
}: StarRowProps) {
  const label = hu.game.starsLabel(stars);
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className="stars"
      data-size={size}
      data-animated={isAnimated}
    >
      {STAR_SLOTS.map((slot) => {
        const isFilled = slot < stars;
        return (
          <span
            key={slot}
            className="stars-slot"
            data-filled={isFilled}
            data-new={isFilled && slot >= previous}
            style={{ "--star-order": slot } as CSSProperties}
          >
            <PixelIcon
              name={isFilled ? "starFull" : "starEmpty"}
              size={size === "lg" ? "lg" : "md"}
            />
          </span>
        );
      })}
    </span>
  );
}
