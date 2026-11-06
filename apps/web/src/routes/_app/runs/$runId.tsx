import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Loading } from "../../../app/StatusScreens.tsx";
import { Notice } from "../../../components/Notice.tsx";
import { useEngine } from "../../../engine/useEngine.ts";
import { hu } from "../../../i18n/hu.ts";
import { errorMessage } from "../../../lib/api.ts";
import { orNotFound, routeId } from "../../../lib/route-ids.ts";
import { runDetailQuery } from "../../../runs/queries.ts";
import { ReplayPage } from "../../../runs/ReplayPage.tsx";

function ReplayRoute() {
  const { runId } = Route.useParams();
  const engine = useEngine();
  const { data, error } = useQuery(runDetailQuery(Number(runId)));
  if (error) {
    return <Notice tone="error" title={errorMessage(error, hu.replay.loadFailed)} live="alert" />;
  }
  if (!data) {
    return <Loading />;
  }
  const map = engine.parseMap(data.map.content).map;
  if (!map) {
    return <Notice tone="error" title={hu.play.loadFailed} live="alert" />;
  }
  return <ReplayPage key={data.run.id} detail={data} map={map} />;
}

export const Route = createFileRoute("/_app/runs/$runId")({
  staticData: { layout: "cab" },
  loader: ({ context, params }) =>
    orNotFound(context.queryClient.ensureQueryData(runDetailQuery(routeId(params.runId)))),
  component: ReplayRoute,
});
