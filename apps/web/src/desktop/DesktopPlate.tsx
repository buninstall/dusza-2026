import { Link as AriaLink } from "react-aria-components";
import { ButtonContent, buttonLook } from "../components/ui/Button.tsx";
import { Menu, MenuItem } from "../components/ui/Menu.tsx";
import { hu } from "../i18n/hu.ts";
import { announceDownload, type DesktopOffer, downloadHref, useDesktopOffer } from "./release.ts";
import "./DesktopPlate.css";

export function DesktopPlate() {
  const { platform, offer } = useDesktopOffer();
  if (!platform) {
    return null;
  }
  return <div className="desktop-slot">{offer ? <DesktopPlateBody offer={offer} /> : null}</div>;
}

function DesktopPlateBody({ offer }: { offer: DesktopOffer }) {
  const { platform, primary, others } = offer;
  return (
    <div className="desktop-plate">
      <AriaLink
        href={downloadHref(primary.format)}
        download
        {...buttonLook("secondary", "sm")}
        className="btn"
        onPress={() => announceDownload(primary.format)}
      >
        <ButtonContent icon="download">{hu.desktop.primary[platform]}</ButtonContent>
      </AriaLink>
      {others.length > 0 ? (
        <Menu label={hu.desktop.more} ariaLabel={hu.desktop.moreLabel} icon="chevronDown">
          {others.map((asset) => (
            <MenuItem
              key={asset.format}
              id={asset.format}
              href={downloadHref(asset.format)}
              download
              onAction={() => announceDownload(asset.format)}
            >
              {hu.desktop.formats[asset.format]}
            </MenuItem>
          ))}
        </Menu>
      ) : null}
    </div>
  );
}
