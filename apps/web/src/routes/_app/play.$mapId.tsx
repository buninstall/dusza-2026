import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { Loading } from "../../app/StatusScreens.tsx";
import { LoadFailed } from "../../components/LoadFailed.tsx";
import { Notice } from "../../components/Notice.tsx";
import { useEngine } from "../../engine/useEngine.ts";
import { hu } from "../../i18n/hu.ts";
import { orNotFound, routeId } from "../../lib/route-ids.ts";
import { mapQuery } from "../../maps/queries.ts";
import { PlayPage } from "../../play/PlayPage.tsx";
import { RecipeConfirm } from "../../recipes/RecipeConfirm.tsx";
import { useRecipeLoader } from "../../recipes/useRecipeLoader.ts";

const searchSchema = z.object({
  recept: z
    .string()
    .regex(/^[a-z0-9-]{1,64}$/)
    .optional()
    .catch(undefined),
});

function PlayRoute() {
  const { mapId } = Route.useParams();
  const { recept } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const engine = useEngine();
  const { data, error, refetch } = useQuery(mapQuery(Number(mapId)));
  const recipe = useRecipeLoader(Number(mapId), recept, () => {
    void navigate({ search: {}, replace: true });
  });
  if (error) {
    return (
      <LoadFailed error={error} fallback={hu.play.loadFailed} onRetry={() => void refetch()} />
    );
  }
  if (!data) {
    return <Loading />;
  }
  const map = engine.parseMap(data.version.content).map;
  if (!map) {
    return <Notice tone="error" title={hu.play.loadFailed} live="alert" />;
  }
  return (
    <>
      <PlayPage
        key={`${data.version.id.toString()}-${(recipe.loaded?.nonce ?? 0).toString()}`}
        detail={data}
        map={map}
        initialDraft={recipe.loaded?.draft}
        shouldFocusEditor={recipe.loaded !== null}
      />
      <RecipeConfirm
        isOpen={recipe.pending !== null}
        onConfirm={recipe.confirm}
        onCancel={recipe.cancel}
      />
    </>
  );
}

export const Route = createFileRoute("/_app/play/$mapId")({
  staticData: { layout: "cab" },
  validateSearch: searchSchema,
  loader: ({ context, params }) =>
    orNotFound(context.queryClient.ensureQueryData(mapQuery(routeId(params.mapId)))),
  component: PlayRoute,
});
