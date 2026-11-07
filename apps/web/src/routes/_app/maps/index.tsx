import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { MapsPage } from "../../../maps/MapsPage.tsx";
import { PLAY_MODES } from "../../../maps/mode.ts";
import { MAP_SORTS } from "../../../maps/sort.ts";

const searchSchema = z.object({
  mode: z.enum(PLAY_MODES).default("sandbox").catch("sandbox"),
  scope: z.enum(["all", "mine"]).default("all").catch("all"),
  sort: z.enum(MAP_SORTS).default("order").catch("order"),
});

function MapsRoute() {
  const { mode, scope, sort } = Route.useSearch();
  const { user } = Route.useRouteContext();
  const navigate = useNavigate({ from: Route.fullPath });
  return (
    <MapsPage
      mode={mode}
      scope={scope}
      sort={sort}
      user={user}
      onModeChange={(next) => void navigate({ search: (prev) => ({ ...prev, mode: next }) })}
      onScopeChange={(next) => void navigate({ search: (prev) => ({ ...prev, scope: next }) })}
      onSortChange={(next) => void navigate({ search: (prev) => ({ ...prev, sort: next }) })}
    />
  );
}

export const Route = createFileRoute("/_app/maps/")({
  validateSearch: searchSchema,
  component: MapsRoute,
});
