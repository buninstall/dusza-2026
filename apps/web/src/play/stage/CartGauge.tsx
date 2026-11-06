import { hu } from "../../i18n/hu.ts";
import { RollingDigits } from "../../pixel/RollingDigits.tsx";
import { PixelSprite } from "../../pixel/SpriteLayers.tsx";
import { CART_LEVELS, TILE_SPRITES } from "../../pixel/tiles.ts";

const PARTIAL_LEVELS = CART_LEVELS - 1;

export function cartLevel(gold: number, total: number): number {
  if (gold <= 0 || total <= 0) {
    return 0;
  }
  return gold >= total ? CART_LEVELS : Math.ceil((gold / total) * PARTIAL_LEVELS);
}

type CartGaugeProps = { gold: number; total: number; reachable: number; isRolling: boolean };

export function CartGauge({ gold, total, reachable, isRolling }: CartGaugeProps) {
  const sprite = TILE_SPRITES.cart[cartLevel(gold, total)] ?? TILE_SPRITES.cart[0];
  return (
    <div className="hud-gauge hud-cart" data-gold-target="true">
      <span className="label">{hu.play.gold}</span>{" "}
      <span className="hud-value">
        <span className="hud-reward">
          <RollingDigits value={gold} scale={3} isRolling={isRolling} />
        </span>
        <span className="visually-hidden">{gold}</span>
        <span className="hud-of">/ {total}</span>
      </span>{" "}
      {sprite ? <PixelSprite sprite={sprite} className="hud-cart-art" /> : null}
      {total === 0 ? <span className="hud-note">{hu.play.noGold}</span> : null}{" "}
      {reachable < total ? (
        <span className="hud-note">{hu.play.goldReachable(reachable)}</span>
      ) : null}
    </div>
  );
}
