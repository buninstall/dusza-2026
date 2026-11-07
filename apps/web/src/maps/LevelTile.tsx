import { Link } from "../components/ui/Link.tsx";
import { NuggetRow } from "../game/NuggetRow.tsx";
import { hu } from "../i18n/hu.ts";
import { story } from "../i18n/hu-story.ts";
import { MapPreview, type PreviewBox } from "../mine/MapPreview.tsx";
import { PixelIcon } from "../pixel/PixelIcon.tsx";
import { PixelText } from "../pixel/PixelText.tsx";
import type { MapSummary } from "./queries.ts";

type LevelTileProps = {
  map: MapSummary;
  depth: number;
  box: PreviewBox;
  canEdit: boolean;
  headingLevel?: 2 | 3;
  isLocked?: boolean;
};

export function MapFacts({ map }: { map: MapSummary }) {
  return (
    <p className="lv-facts">
      <span className="lv-author">{hu.maps.by(map.ownerName)}</span>
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

function PlayAction({ map, isLocked }: { map: MapSummary; isLocked: boolean }) {
  if (isLocked) {
    return (
      <p className="lv-locked">
        <PixelIcon name="lock" />
        <span>{story.lockedTile}</span>
      </p>
    );
  }
  return (
    <Link
      to="/play/$mapId"
      params={{ mapId: String(map.id) }}
      variant="primary"
      icon="play"
      className="lv-play"
      aria-label={hu.maps.actionFor(hu.maps.play, map.title)}
    >
      {hu.maps.play}
    </Link>
  );
}

export function LevelTile({
  map,
  depth,
  box,
  canEdit,
  headingLevel = 2,
  isLocked = false,
}: LevelTileProps) {
  const mapId = String(map.id);
  const level = hu.signs.level(depth);
  const Title = headingLevel === 3 ? "h3" : "h2";
  return (
    <li
      className="lv-tile"
      data-mine="level"
      data-map-id={mapId}
      data-stars={isLocked ? -1 : (map.stars ?? -1)}
      data-locked={isLocked}
    >
      <div className="lv-window" data-mine-pit="">
        <MapPreview content={map.content} box={box} className="lv-preview" isFitted />
        {isLocked ? (
          <span className="lv-padlock">
            <PixelIcon name="lock" size="lg" />
          </span>
        ) : null}
      </div>
      <div className="lv-body">
        <div className="lv-head">
          <p className="lv-depth">
            <PixelText text={level} scale={2} />
            <span className="visually-hidden">{level}</span>
          </p>
          <Title className="lv-title">{map.title}</Title>
        </div>
        <div className="lv-meta">
          <MapFacts map={map} />
          {isLocked ? null : <Progress map={map} />}
        </div>
      </div>
      <div className="lv-actions">
        <PlayAction map={map} isLocked={isLocked} />
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
            variant="secondary"
            size="sm"
            icon="pickaxe"
            className="lv-edit"
            aria-label={hu.maps.actionFor(hu.maps.edit, map.title)}
          >
            <span className="visually-hidden">{hu.maps.edit}</span>
          </Link>
        ) : null}
      </div>
    </li>
  );
}
