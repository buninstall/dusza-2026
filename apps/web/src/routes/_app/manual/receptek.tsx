import { createFileRoute } from "@tanstack/react-router";
import { withEngine } from "../../../engine/EngineProvider.tsx";
import { RecipesPage } from "../../../recipes/RecipesPage.tsx";

export const Route = createFileRoute("/_app/manual/receptek")({
  component: withEngine(RecipesPage),
});
