import { createFileRoute } from "@tanstack/react-router";
import { RecipesPage } from "../../../recipes/RecipesPage.tsx";

export const Route = createFileRoute("/_app/manual/receptek")({
  component: RecipesPage,
});
