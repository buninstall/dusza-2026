import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { LeaderboardPage } from "../../leaderboard/LeaderboardPage.tsx";
import { orNotFound, routeId } from "../../lib/route-ids.ts";
import { leaderboardQuery } from "../../maps/queries.ts";

const searchSchema = z.object({
  version: z.coerce.number().int().positive().optional().catch(undefined),
});

function LeaderboardRoute() {
  const { mapId } = Route.useParams();
  const { version } = Route.useSearch();
  const { user } = Route.useRouteContext();
  const navigate = useNavigate({ from: Route.fullPath });
  return (
    <LeaderboardPage
      mapId={Number(mapId)}
      versionId={version}
      user={user}
      onVersionChange={(next) => void navigate({ search: { version: next } })}
    />
  );
}

export const Route = createFileRoute("/_app/leaderboard/$mapId")({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ version: search.version }),
  loader: ({ context, params, deps }) =>
    orNotFound(
      context.queryClient.ensureQueryData(leaderboardQuery(routeId(params.mapId), deps.version)),
    ),
  component: LeaderboardRoute,
});
