import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { LeaderboardPage } from "../../leaderboard/LeaderboardPage.tsx";

const searchSchema = z.object({ version: z.coerce.number().int().positive().optional() });

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
  component: LeaderboardRoute,
});
