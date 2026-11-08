import { Toolbar } from "react-aria-components";
import { IconButton } from "../../components/ui/IconButton.tsx";
import { hu } from "../../i18n/hu.ts";
import { usePlayUi, ZOOM_MAX, ZOOM_MIN } from "../play-ui-store.ts";

const PERCENT = 100;

export function WellZoom() {
  const zoom = usePlayUi((state) => state.zoom);
  const shiftZoom = usePlayUi((state) => state.shiftZoom);
  return (
    <Toolbar className="well-zoom" aria-label={hu.play.zoomGroup}>
      <IconButton
        icon="minus"
        label={hu.play.zoomOut}
        size="sm"
        isDisabled={zoom <= ZOOM_MIN}
        onPress={() => shiftZoom(-1)}
      />
      <output className="well-zoom-level k-screen" aria-live="polite">
        {hu.play.zoomLevel(Math.round(zoom * PERCENT))}
      </output>
      <IconButton
        icon="plus"
        label={hu.play.zoomIn}
        size="sm"
        isDisabled={zoom >= ZOOM_MAX}
        onPress={() => shiftZoom(1)}
      />
    </Toolbar>
  );
}
