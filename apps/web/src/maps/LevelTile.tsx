import { Link } from "../components/ui/Link.tsx";
import { NuggetRow } from "../game/NuggetRow.tsx";
import { hu } from "../i18n/hu.ts";
import { MapPreview, type PreviewBox } from "../mine/MapPreview.tsx";
import { PixelText } from "../pixel/PixelText.tsx";
import type { MapSummary } from "./queries.ts";

type LevelTileProps = {
  map: MapSummary;
  depth: number;
  box: PreviewBox;
  canEdit: boolean;
};

export function MapFacts({ map }: { map: MapSummary }) {
  return (
    <p className="lv-facts">
      <span>{hu.maps.by(map.ownerName)}</span>
      {map.difficulty ? (
        <span className="lv-difficulty" data-level={map.difficulty}>
          {hu.maps.difficulty[map.difficulty]}
        </span>
      ) : null}
    </p>
  );
}

export function Progress({ map }: { map: MapSummary }) {
  if (map.stars === null) {
    return null;
  }
  return (
    <div className="lv-progress">
      <NuggetRow earned={map.stars} size="sm" />
      {map.best ? (
        <span className="lv-progress-best">{hu.game.best(map.best.gold, map.best.steps)}</span>
      ) : null}
    </div>
  );
}

export function LevelTile({ map, depth, box, canEdit }: LevelTileProps) {
  const mapId = String(map.id);
  const level = hu.signs.level(depth);
  return (
    <li className="lv-tile" data-mine="level" data-map-id={mapId} data-stars={map.stars ?? -1}>
      <div className="lv-window" data-mine-pit="">
        <MapPreview content={map.content} box={box} className="lv-preview" isFitted />
      </div>
      <div className="lv-body">
        <div className="lv-head">
          <p className="lv-depth">
            <PixelText text={level} scale={2} />
            <span className="visually-hidden">{level}</span>
          </p>
          <h2 className="lv-title">{map.title}</h2>
        </div>
        <div className="lv-meta">
          <MapFacts map={map} />
          <Progress map={map} />
        </div>
      </div>
      <div className="lv-actions">
        <Link
          to="/play/$mapId"
          params={{ mapId }}
          variant="primary"
          icon="play"
          className="lv-play"
          aria-label={hu.maps.actionFor(hu.maps.play, map.title)}
        >
          {hu.maps.play}
        </Link>
        <Link
          to="/leaderboard/$mapId"
          params={{ mapId }}
          variant="secondary"
          size="sm"
          icon="trophy"
          aria-label={hu.maps.actionFor(hu.maps.leaderboard, map.title)}
        >
          {hu.maps.leaderboard}
        </Link>
        {canEdit ? (
          <Link
            to="/maps/$mapId/edit"
            params={{ mapId }}
            variant="ghost"
            size="sm"
            icon="pickaxe"
            aria-label={hu.maps.actionFor(hu.maps.edit, map.title)}
          >
            {hu.maps.edit}
          </Link>
        ) : null}
      </div>
    </li>
  );
}
