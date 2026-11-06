import { InlineText } from "../components/InlineText.tsx";
import { Button } from "../components/ui/Button.tsx";
import { Link } from "../components/ui/Link.tsx";
import { hu } from "../i18n/hu.ts";
import { downloadText } from "../lib/files.ts";
import { MapPreview } from "../mine/MapPreview.tsx";
import {
  BAD_MAPS,
  baseName,
  ERROR_RECIPES,
  type ErrorRecipe,
  MAP_RECIPES,
  type MapRecipe,
  recipeText,
} from "./catalog.ts";

export type MapLookup = (mapFile: string) => number | undefined;

export function DownloadButton({ file }: { file: string }) {
  const name = baseName(file);
  return (
    <Button
      size="sm"
      icon="download"
      aria-label={hu.recipes.download(name)}
      onPress={() => downloadText(name, recipeText(file))}
    >
      {name.slice(name.lastIndexOf("."))}
    </Button>
  );
}

function OpenAction({
  mapId,
  slug,
  file,
}: {
  mapId: number | undefined;
  slug: string;
  file: string;
}) {
  if (mapId === undefined) {
    return (
      <span className="rc-missing">
        <Button size="sm" icon="play" isDisabled>
          {hu.recipes.open}
        </Button>
        <span className="rc-reason">{hu.recipes.notInDb}</span>
      </span>
    );
  }
  return (
    <Link
      to="/play/$mapId"
      params={{ mapId: String(mapId) }}
      search={{ recept: slug }}
      variant="primary"
      size="sm"
      icon="play"
      aria-label={hu.recipes.openFor(baseName(file))}
    >
      {hu.recipes.open}
    </Link>
  );
}

function MapRecipeRow({ recipe, mapId }: { recipe: MapRecipe; mapId: number | undefined }) {
  return (
    <li className="rc-row">
      <MapPreview content={recipeText(recipe.mapFile)} box={64} className="rc-preview" />
      <div className="rc-main">
        <h3 className="rc-title">{recipe.title}</h3>
        <p className="rc-file mono">{recipe.file}</p>
        <p className="rc-hint">
          <InlineText text={recipe.hint} />
        </p>
      </div>
      <dl className="rc-expect">
        <div>
          <dt>{hu.recipes.gold}</dt>
          <dd>{hu.maps.gold(recipe.gold, recipe.total)}</dd>
        </div>
        <div>
          <dt>{hu.recipes.steps}</dt>
          <dd>{recipe.steps}</dd>
        </div>
      </dl>
      <div className="rc-actions">
        <OpenAction mapId={mapId} slug={recipe.slug} file={recipe.file} />
        <DownloadButton file={recipe.file} />
        <DownloadButton file={recipe.mapFile} />
      </div>
    </li>
  );
}

export function MapRecipeList({ lookup }: { lookup: MapLookup }) {
  return (
    <ul className="rc-list">
      {MAP_RECIPES.map((recipe) => (
        <MapRecipeRow key={recipe.slug} recipe={recipe} mapId={lookup(recipe.mapFile)} />
      ))}
    </ul>
  );
}

function ErrorRow({ recipe, mapId }: { recipe: ErrorRecipe; mapId: number | undefined }) {
  return (
    <tr>
      <th scope="row" className="mono">
        {baseName(recipe.file)}
      </th>
      <td className="mono rc-code">{recipe.code ?? hu.recipes.syntaxError}</td>
      <td className="data-table-number">{recipe.lines.join(", ")}</td>
      <td className="data-table-number">{recipe.steps}</td>
      <td className="data-table-muted">
        <InlineText text={recipe.hint} />
      </td>
      <td>
        <span className="data-table-actions">
          <OpenAction mapId={mapId} slug={recipe.slug} file={recipe.file} />
          <DownloadButton file={recipe.file} />
        </span>
      </td>
    </tr>
  );
}

export function ErrorRecipeTable({ mapId }: { mapId: number | undefined }) {
  return (
    <div className="data-table">
      <table className="data-table-grid rc-table">
        <caption className="visually-hidden">{hu.recipes.sectionErrors}</caption>
        <thead>
          <tr>
            <th scope="col">{hu.recipes.program}</th>
            <th scope="col">{hu.recipes.expectedError}</th>
            <th scope="col" className="data-table-number">
              {hu.recipes.line}
            </th>
            <th scope="col" className="data-table-number">
              {hu.recipes.steps}
            </th>
            <th scope="col">{hu.recipes.watch}</th>
            <th scope="col">
              <span className="visually-hidden">{hu.recipes.actions}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {ERROR_RECIPES.map((recipe) => (
            <ErrorRow key={recipe.slug} recipe={recipe} mapId={mapId} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function BadMapTable() {
  return (
    <div className="data-table">
      <table className="data-table-grid rc-table rc-table-narrow">
        <caption className="visually-hidden">{hu.recipes.sectionBadMaps}</caption>
        <thead>
          <tr>
            <th scope="col">{hu.recipes.mapFile}</th>
            <th scope="col">{hu.recipes.expectedError}</th>
            <th scope="col">
              <span className="visually-hidden">{hu.recipes.actions}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {BAD_MAPS.map((bad) => (
            <tr key={bad.file}>
              <th scope="row" className="mono">
                {baseName(bad.file)}
              </th>
              <td className="mono rc-code">{bad.code}</td>
              <td>
                <DownloadButton file={bad.file} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
