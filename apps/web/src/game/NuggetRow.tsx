import type { CSSProperties } from "react";
import { hu } from "../i18n/hu.ts";
import { PixelSprite } from "../pixel/SpriteLayers.tsx";
import { TILE_SPRITES } from "../pixel/tiles.ts";
import "./NuggetRow.css";

export const MAX_NUGGETS = 3;

const SLOTS = Array.from({ length: MAX_NUGGETS }, (_, index) => index);

type NuggetRowProps = {
  earned: number;
  size?: "sm" | "md" | "lg";
  previous?: number;
  isAnimated?: boolean;
};

export function NuggetRow({
  earned,
  size = "md",
  previous = earned,
  isAnimated = false,
}: NuggetRowProps) {
  const label = hu.game.nuggetsLabel(earned);
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className="nuggets"
      data-size={size}
      data-animated={isAnimated}
    >
      {SLOTS.map((slot) => {
        const isEarned = slot < earned;
        return (
          <span
            key={slot}
            className="nuggets-slot"
            data-earned={isEarned}
            data-new={isEarned && slot >= previous}
            style={{ "--nugget-order": slot } as CSSProperties}
          >
            <PixelSprite sprite={TILE_SPRITES.nugget} className="nuggets-art" />
          </span>
        );
      })}
    </span>
  );
}
