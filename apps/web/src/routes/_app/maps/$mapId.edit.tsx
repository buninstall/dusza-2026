import { createFileRoute } from "@tanstack/react-router";
import { EditMapPage } from "../../../map-editor/MapEditorPages.tsx";

function EditMapRoute() {
  const { mapId } = Route.useParams();
  return <EditMapPage key={mapId} mapId={Number(mapId)} />;
}

export const Route = createFileRoute("/_app/maps/$mapId/edit")({
  component: EditMapRoute,
});
