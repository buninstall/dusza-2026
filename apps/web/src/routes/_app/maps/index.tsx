import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { MapsPage } from "../../../maps/MapsPage.tsx";
import { MAP_SORTS } from "../../../maps/sort.ts";

const searchSchema = z.object({
  scope: z.enum(["all", "mine"]).default("all").catch("all"),
  sort: z.enum(MAP_SORTS).default("order").catch("order"),
});

function MapsRoute() {
  const { scope, sort } = Route.useSearch();
  const { user } = Route.useRouteContext();
  const navigate = useNavigate({ from: Route.fullPath });
  return (
    <MapsPage
      scope={scope}
      sort={sort}
      user={user}
      onScopeChange={(next) => void navigate({ search: (prev) => ({ ...prev, scope: next }) })}
      onSortChange={(next) => void navigate({ search: (prev) => ({ ...prev, sort: next }) })}
    />
  );
}

export const Route = createFileRoute("/_app/maps/")({
  validateSearch: searchSchema,
  component: MapsRoute,
});
