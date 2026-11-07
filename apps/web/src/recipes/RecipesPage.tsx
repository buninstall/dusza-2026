import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import "../components/DataTable.css";
import { LocationPlate } from "../components/LocationPlate.tsx";
import { NumberedHeading } from "../components/NumberedHeading.tsx";
import { Link } from "../components/ui/Link.tsx";
import { hu } from "../i18n/hu.ts";
import { recipePage } from "../i18n/hu-recipes.ts";
import { mapsQuery } from "../maps/queries.ts";
import { CORRIDOR_FILE, MAP_RECIPES, normaliseMap, recipeText } from "./catalog.ts";
import { BadMapTable, ErrorRecipeTable, type MapLookup, MapRecipeList } from "./RecipeRows.tsx";
import "./RecipesPage.css";

function useMapLookup(): MapLookup {
  const { data } = useQuery(mapsQuery("all"));
  const byContent = new Map((data?.maps ?? []).map((map) => [normaliseMap(map.content), map.id]));
  return (mapFile) => byContent.get(normaliseMap(recipeText(mapFile)));
}

const STORY_RECIPES = MAP_RECIPES.filter((recipe) => recipe.world === "story");
const SANDBOX_RECIPES = MAP_RECIPES.filter((recipe) => recipe.world === "sandbox");

function RecipeSection({
  id,
  number,
  title,
  children,
}: {
  id: string;
  number: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={`${id}-title`} className="rc-section">
      <NumberedHeading id={`${id}-title`} number={number} title={title} />
      {children}
    </section>
  );
}

export function RecipesPage() {
  const lookup = useMapLookup();
  return (
    <div className="rc-page">
      <LocationPlate
        name={hu.signs.recipes}
        lead={
          <Link to="/manual" variant="ghost" size="sm" icon="arrowLeft">
            {hu.recipes.back}
          </Link>
        }
      />
      <RecipeSection id="rc-maps" number={1} title={recipePage.sectionStory}>
        <p className="rc-lead">{recipePage.storyLead}</p>
        <MapRecipeList lookup={lookup} recipes={STORY_RECIPES} />
      </RecipeSection>
      <RecipeSection id="rc-sandbox" number={2} title={recipePage.sectionSandbox}>
        <p className="rc-lead">{recipePage.sandboxLead}</p>
        <MapRecipeList lookup={lookup} recipes={SANDBOX_RECIPES} />
      </RecipeSection>
      <RecipeSection id="rc-errors" number={3} title={hu.recipes.sectionErrors}>
        <p className="rc-lead">{hu.recipes.errorsHint}</p>
        <ErrorRecipeTable mapId={lookup(CORRIDOR_FILE)} />
      </RecipeSection>
      <RecipeSection id="rc-bad-maps" number={4} title={hu.recipes.sectionBadMaps}>
        <p className="rc-lead">
          {hu.recipes.badMapsHint}{" "}
          <Link to="/maps/new" variant="text">
            {hu.recipes.toEditor}
          </Link>
        </p>
        <BadMapTable />
      </RecipeSection>
    </div>
  );
}
