import { ToggleButton } from "react-aria-components";
import { buttonLook } from "../components/ui/Button.tsx";
import { browse } from "../i18n/hu-browse.ts";
import { PixelIcon } from "../pixel/PixelIcon.tsx";
import { type MapSummary, useToggleFavorite } from "./queries.ts";

export function FavoriteButton({ map }: { map: MapSummary }) {
  const toggle = useToggleFavorite();
  const label = `${browse.favorite}: ${map.title}, ${browse.favoriteCount(map.favoriteCount)}`;
  return (
    <ToggleButton
      {...buttonLook("ghost", "sm")}
      className="btn lv-fav"
      isSelected={map.isFavorite}
      aria-label={label}
      onChange={(isFavorite) => toggle.mutate({ mapId: map.id, title: map.title, isFavorite })}
    >
      <PixelIcon name={map.isFavorite ? "heart" : "heartEmpty"} />
      <span className="lv-fav-count">{map.favoriteCount}</span>
    </ToggleButton>
  );
}
