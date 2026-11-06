import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { MapsPage } from "../../../maps/MapsPage.tsx";

const searchSchema = z.object({ scope: z.enum(["all", "mine"]).default("all") });

function MapsRoute() {
  const { scope } = Route.useSearch();
  const { user } = Route.useRouteContext();
  const navigate = useNavigate({ from: Route.fullPath });
  return (
    <MapsPage
      scope={scope}
      user={user}
      onScopeChange={(next) => void navigate({ search: { scope: next } })}
    />
  );
}

export const Route = createFileRoute("/_app/maps/")({
  validateSearch: searchSchema,
  component: MapsRoute,
});
