import { Link } from "../components/ui/Link.tsx";
import { hu } from "../i18n/hu.ts";
import { MapPreview, type PreviewBox } from "../mine/MapPreview.tsx";
import { PixelIcon } from "../pixel/PixelIcon.tsx";
import { PixelText } from "../pixel/PixelText.tsx";
import type { MapSummary } from "./queries.ts";

type LevelTileProps = {
  map: MapSummary;
  depth: number;
  box: PreviewBox;
  isOwn: boolean;
  canEdit: boolean;
};

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div className="lv-spec">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function Badges({ map, isOwn }: { map: MapSummary; isOwn: boolean }) {
  const unreachable = map.goldTotal - map.reachableGold;
  return (
    <span className="lv-badges">
      {unreachable > 0 ? (
        <span className="lv-badge" data-tone="warning">
          <PixelIcon name="warning" size="sm" />
          {hu.maps.goldUnreachable(unreachable)}
        </span>
      ) : null}
      {map.visibility === "private" ? (
        <span className="lv-badge">
          <PixelIcon name="lock" size="sm" />
          {hu.maps.private}
        </span>
      ) : null}
      {isOwn ? (
        <span className="lv-badge" data-tone="own">
          {hu.maps.own}
        </span>
      ) : null}
    </span>
  );
}

export function LevelTile({ map, depth, box, isOwn, canEdit }: LevelTileProps) {
  const mapId = String(map.id);
  const level = hu.signs.level(depth);
  return (
    <li className="lv-tile">
      <span aria-hidden="true" className="lv-rail" />
      <p className="lv-depth">
        <PixelText text={level} scale={2} />
        <span className="visually-hidden">{level}</span>
      </p>
      <div className="lv-window">
        <MapPreview content={map.content} box={box} className="lv-preview" />
      </div>
      <div className="lv-body">
        <h2 className="lv-title">
          {map.title}
          <Badges map={map} isOwn={isOwn} />
        </h2>
        <dl className="lv-specs">
          <Spec label={hu.maps.sizeLabel} value={hu.maps.size(map.rows, map.cols)} />
          <Spec label={hu.maps.goldLabel} value={hu.maps.gold(map.reachableGold, map.goldTotal)} />
          <Spec label={hu.maps.versionLabel} value={hu.maps.version(map.version)} />
          <Spec label={hu.maps.ownerLabel} value={map.ownerName} />
        </dl>
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
