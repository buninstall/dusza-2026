import { createFileRoute } from "@tanstack/react-router";
import { orNotFound, routeId } from "../../../lib/route-ids.ts";
import { EditMapPage } from "../../../map-editor/MapEditorPages.tsx";
import { mapQuery } from "../../../maps/queries.ts";

function EditMapRoute() {
  const { mapId } = Route.useParams();
  return <EditMapPage key={mapId} mapId={Number(mapId)} />;
}

export const Route = createFileRoute("/_app/maps/$mapId/edit")({
  staticData: { layout: "workbench" },
  loader: ({ context, params }) =>
    orNotFound(context.queryClient.ensureQueryData(mapQuery(routeId(params.mapId)))),
  component: EditMapRoute,
});
