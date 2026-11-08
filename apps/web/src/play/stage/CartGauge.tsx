import { hu } from "../../i18n/hu.ts";
import { PixelSprite } from "../../pixel/SpriteLayers.tsx";
import { CART_LEVELS, TILE_SPRITES } from "../../pixel/tiles.ts";
import { Odometer } from "./Odometer.tsx";

const PARTIAL_LEVELS = CART_LEVELS - 1;

export function cartLevel(gold: number, total: number): number {
  if (gold <= 0 || total <= 0) {
    return 0;
  }
  return gold >= total ? CART_LEVELS : Math.ceil((gold / total) * PARTIAL_LEVELS);
}

type CartGaugeProps = { gold: number; total: number; isRolling: boolean };

export function CartGauge({ gold, total, isRolling }: CartGaugeProps) {
  const sprite = TILE_SPRITES.cart[cartLevel(gold, total)] ?? TILE_SPRITES.cart[0];
  return (
    <div className="hud-cell hud-cart" data-gold-target="true">
      <span className="hud-label">{hu.play.gold}</span>{" "}
      <span className="visually-hidden">
        {gold} / {total}
      </span>
      <Odometer value={gold} digits={String(total).length} isRolling={isRolling} />
      <span aria-hidden="true" className="hud-of">
        /{total}
      </span>
      {sprite ? <PixelSprite sprite={sprite} className="hud-cart-art" /> : null}
    </div>
  );
}
