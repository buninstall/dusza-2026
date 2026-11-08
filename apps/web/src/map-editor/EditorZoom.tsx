import { Toolbar } from "react-aria-components";
import { IconButton } from "../components/ui/IconButton.tsx";
import { hu } from "../i18n/hu.ts";
import { nextSceneZoom, SCENE_ZOOM_MAX, SCENE_ZOOM_MIN } from "../mine/scene/zoom.ts";

const PERCENT = 100;

type EditorZoomProps = { zoom: number; onZoomChange: (zoom: number) => void };

export function EditorZoom({ zoom, onZoomChange }: EditorZoomProps) {
  return (
    <Toolbar className="ed-zoom" aria-label={hu.play.zoomGroup}>
      <IconButton
        icon="minus"
        label={hu.play.zoomOut}
        size="sm"
        aria-keyshortcuts="-"
        isDisabled={zoom <= SCENE_ZOOM_MIN}
        onPress={() => onZoomChange(nextSceneZoom(zoom, -1))}
      />
      <output className="k-screen ed-zoom-level" aria-live="polite">
        {hu.play.zoomLevel(Math.round(zoom * PERCENT))}
      </output>
      <IconButton
        icon="plus"
        label={hu.play.zoomIn}
        size="sm"
        aria-keyshortcuts="+"
        isDisabled={zoom >= SCENE_ZOOM_MAX}
        onPress={() => onZoomChange(nextSceneZoom(zoom, 1))}
      />
    </Toolbar>
  );
}
