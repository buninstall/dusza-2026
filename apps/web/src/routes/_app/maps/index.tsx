import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { MapsPage } from "../../../maps/MapsPage.tsx";
import { DIFFICULTY_FILTERS, PLAY_MODES } from "../../../maps/mode.ts";
import { MAP_SORTS } from "../../../maps/sort.ts";

const searchSchema = z.object({
  mode: z.enum(PLAY_MODES).default("sandbox").catch("sandbox"),
  scope: z.enum(["all", "mine"]).default("all").catch("all"),
  sort: z.enum(MAP_SORTS).default("recent").catch("recent"),
  level: z.enum(DIFFICULTY_FILTERS).default("all").catch("all"),
});

function MapsRoute() {
  const { mode, scope, sort, level } = Route.useSearch();
  const { user } = Route.useRouteContext();
  const navigate = useNavigate({ from: Route.fullPath });
  return (
    <MapsPage
      mode={mode}
      scope={scope}
      sort={sort}
      difficulty={level}
      user={user}
      onModeChange={(next) => void navigate({ search: (prev) => ({ ...prev, mode: next }) })}
      onScopeChange={(next) => void navigate({ search: (prev) => ({ ...prev, scope: next }) })}
      onSortChange={(next) => void navigate({ search: (prev) => ({ ...prev, sort: next }) })}
      onDifficultyChange={(next) => void navigate({ search: (prev) => ({ ...prev, level: next }) })}
    />
  );
}

export const Route = createFileRoute("/_app/maps/")({
  validateSearch: searchSchema,
  component: MapsRoute,
});
