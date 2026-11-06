import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Notice } from "../../components/Notice.tsx";
import { useEngine } from "../../engine/useEngine.ts";
import { hu } from "../../i18n/hu.ts";
import { errorMessage } from "../../lib/api.ts";
import { mapQuery } from "../../map/queries.ts";
import { PlayPage } from "../../runner/PlayPage.tsx";

function PlayRoute() {
  const { mapId } = Route.useParams();
  const engine = useEngine();
  const { data, error } = useQuery(mapQuery(Number(mapId)));
  if (error) {
    return <Notice tone="error" title={errorMessage(error, hu.play.loadFailed)} />;
  }
  if (!data) {
    return <p className="pt-6 text-ink-muted">{hu.common.loading}</p>;
  }
  const map = engine.parseMap(data.version.content).map;
  if (!map) {
    return <Notice tone="error" title={hu.play.loadFailed} />;
  }
  return <PlayPage key={data.version.id} detail={data} map={map} />;
}

export const Route = createFileRoute("/_app/play/$mapId")({
  component: PlayRoute,
});
