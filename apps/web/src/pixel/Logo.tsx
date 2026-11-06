import { hu } from "../i18n/hu.ts";
import { LOGO_MARK } from "./logo-art.ts";
import "./pixel.css";
import { PixelSprite } from "./SpriteLayers.tsx";

type LogoProps = { size?: "md" | "xl" };

export function Logo({ size = "md" }: LogoProps) {
  return (
    <span className="px-logo" data-size={size}>
      <span className="px-logo-mark">
        <PixelSprite sprite={LOGO_MARK} />
      </span>
      <span className="px-wordmark">
        {hu.app.wordmarkStart}
        <span className="px-wordmark-accent">{hu.app.wordmarkEnd}</span>
      </span>
    </span>
  );
}
