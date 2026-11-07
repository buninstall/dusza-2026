import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { MapsPage } from "../../../maps/MapsPage.tsx";
import { DIFFICULTY_FILTERS, MAP_SCOPES, PLAY_MODES, SEARCH_MAX } from "../../../maps/mode.ts";
import { MAP_SORTS } from "../../../maps/sort.ts";

const MAX_PAGE = 100_000;

const searchSchema = z.object({
  mode: z.enum(PLAY_MODES).default("sandbox").catch("sandbox"),
  scope: z.enum(MAP_SCOPES).default("all").catch("all"),
  sort: z.enum(MAP_SORTS).default("recent").catch("recent"),
  level: z.enum(DIFFICULTY_FILTERS).default("all").catch("all"),
  page: z.coerce.number().int().min(1).max(MAX_PAGE).default(1).catch(1),
  q: z
    .string()
    .transform((value) => value.trim().slice(0, SEARCH_MAX))
    .default("")
    .catch(""),
});

function MapsRoute() {
  const { mode, scope, sort, level, page, q } = Route.useSearch();
  const { user } = Route.useRouteContext();
  const navigate = useNavigate({ from: Route.fullPath });
  const refine = (patch: Partial<z.output<typeof searchSchema>>) =>
    void navigate({ search: (prev) => ({ ...prev, ...patch, page: 1 }) });
  return (
    <MapsPage
      mode={mode}
      scope={scope}
      sort={sort}
      difficulty={level}
      page={page}
      q={q}
      user={user}
      onModeChange={(next) => void navigate({ search: (prev) => ({ ...prev, mode: next }) })}
      onScopeChange={(next) => refine({ scope: next })}
      onSortChange={(next) => refine({ sort: next })}
      onDifficultyChange={(next) => refine({ level: next })}
      onSearch={(next) =>
        void navigate({
          search: (prev) => ({ ...prev, q: next, page: 1 }),
          replace: true,
          resetScroll: false,
        })
      }
      onPageChange={(next) =>
        void navigate({ search: (prev) => ({ ...prev, page: next }), resetScroll: false })
      }
    />
  );
}

export const Route = createFileRoute("/_app/maps/")({
  validateSearch: searchSchema,
  component: MapsRoute,
});
