import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Loading } from "../../app/StatusScreens.tsx";
import { Notice } from "../../components/Notice.tsx";
import { useEngine } from "../../engine/useEngine.ts";
import { hu } from "../../i18n/hu.ts";
import { errorMessage } from "../../lib/api.ts";
import { orNotFound, routeId } from "../../lib/route-ids.ts";
import { mapQuery } from "../../maps/queries.ts";
import { PlayPage } from "../../play/PlayPage.tsx";

function PlayRoute() {
  const { mapId } = Route.useParams();
  const engine = useEngine();
  const { data, error } = useQuery(mapQuery(Number(mapId)));
  if (error) {
    return <Notice tone="error" title={errorMessage(error, hu.play.loadFailed)} live="alert" />;
  }
  if (!data) {
    return <Loading />;
  }
  const map = engine.parseMap(data.version.content).map;
  if (!map) {
    return <Notice tone="error" title={hu.play.loadFailed} live="alert" />;
  }
  return <PlayPage key={data.version.id} detail={data} map={map} />;
}

export const Route = createFileRoute("/_app/play/$mapId")({
  staticData: { layout: "cab" },
  loader: ({ context, params }) =>
    orNotFound(context.queryClient.ensureQueryData(mapQuery(routeId(params.mapId)))),
  component: PlayRoute,
});
