import { Link } from "../components/ui/Link.tsx";
import { hu } from "../i18n/hu.ts";
import { MapPreview } from "../mine/MapPreview.tsx";
import { PixelIcon } from "../pixel/PixelIcon.tsx";
import "./MapsPage.css";
import type { MapSummary } from "./queries.ts";

type ShaftLevelProps = { map: MapSummary; depth: number; canEdit: boolean };

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div className="maps-spec">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export function ShaftLevel({ map, depth, canEdit }: ShaftLevelProps) {
  const mapId = String(map.id);
  const unreachable = map.goldTotal - map.reachableGold;
  return (
    <li className="maps-level">
      <p className="maps-depth">{hu.maps.level(depth)}</p>
      <MapPreview content={map.content} className="maps-preview" />
      <div className="maps-info">
        <h2 className="maps-map-title">
          {map.title}
          {map.visibility === "private" ? (
            <span className="maps-badge">
              <PixelIcon name="lock" size="sm" />
              {hu.maps.private}
            </span>
          ) : null}
        </h2>
        {map.description ? <p className="maps-description">{map.description}</p> : null}
        <dl className="maps-specs">
          <Spec label={hu.maps.sizeLabel} value={hu.maps.size(map.rows, map.cols)} />
          <Spec
            label={hu.maps.goldLabel}
            value={
              unreachable > 0
                ? `${hu.maps.gold(map.reachableGold, map.goldTotal)} · ${hu.maps.goldUnreachable(unreachable)}`
                : hu.maps.gold(map.reachableGold, map.goldTotal)
            }
          />
          <Spec label={hu.maps.versionLabel} value={hu.maps.version(map.version)} />
          <Spec label={hu.maps.ownerLabel} value={map.ownerName} />
        </dl>
      </div>
      <div className="maps-actions">
        <Link
          to="/play/$mapId"
          params={{ mapId }}
          variant="primary"
          icon="play"
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
