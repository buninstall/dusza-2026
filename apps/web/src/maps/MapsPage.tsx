import { useQuery } from "@tanstack/react-query";
import { type RefObject, useRef } from "react";
import { Loading } from "../app/StatusScreens.tsx";
import type { SessionUser } from "../auth/session.ts";
import { EmptyState } from "../components/EmptyState.tsx";
import { LoadFailed } from "../components/LoadFailed.tsx";
import { LocationPlate } from "../components/LocationPlate.tsx";
import { Link } from "../components/ui/Link.tsx";
import { Select } from "../components/ui/Select.tsx";
import { Tab, TabList, TabPanel, Tabs } from "../components/ui/Tabs.tsx";
import { MAX_NUGGETS } from "../game/NuggetRow.tsx";
import { hu } from "../i18n/hu.ts";
import { useMediaQuery } from "../lib/useMediaQuery.ts";
import { PixelIcon } from "../pixel/PixelIcon.tsx";
import { PixelSprite } from "../pixel/SpriteLayers.tsx";
import { TILE_SPRITES } from "../pixel/tiles.ts";
import { TourPrompt } from "../tour/TourPrompt.tsx";
import { DailyCard } from "./DailyCard.tsx";
import { MineBackdrop } from "./deep/MineBackdrop.tsx";
import { LevelTile } from "./LevelTile.tsx";
import "./MapsPage.css";
import { dailyQuery, type MapScope, mapsQuery } from "./queries.ts";
import { MAP_SORTS, type MapSort, sortMaps } from "./sort.ts";

type MapsPageProps = {
  scope: MapScope;
  sort: MapSort;
  user: SessionUser;
  onScopeChange: (scope: MapScope) => void;
  onSortChange: (sort: MapSort) => void;
};

const SORT_OPTIONS = MAP_SORTS.map((id) => ({ id, label: hu.maps.sorts[id] }));

function NewMapLink() {
  return (
    <Link to="/maps/new" variant="primary" icon="pickaxe">
      {hu.maps.newMap}
    </Link>
  );
}

function LevelGrid({ scope, sort, user }: { scope: MapScope; sort: MapSort; user: SessionUser }) {
  const { data, error, isPending, refetch } = useQuery(mapsQuery(scope));
  const isWide = useMediaQuery("(min-width: 48rem)", true);
  if (error) {
    return (
      <LoadFailed error={error} fallback={hu.maps.loadFailed} onRetry={() => void refetch()} />
    );
  }
  if (isPending) {
    return <Loading />;
  }
  if (data.maps.length === 0) {
    return (
      <EmptyState
        text={scope === "mine" ? hu.maps.emptyMine : hu.maps.empty}
        action={<NewMapLink />}
      />
    );
  }
  const depthOf = new Map(sortMaps(data.maps, "order").map((map, index) => [map.id, index + 1]));
  return (
    <>
      <ol className="lv-shaft" aria-label={hu.maps.listLabel}>
        {sortMaps(data.maps, sort).map((map) => (
          <LevelTile
            key={map.id}
            map={map}
            depth={depthOf.get(map.id) ?? 1}
            box={isWide ? 120 : 64}
            canEdit={map.ownerId === user.id || user.role === "admin"}
          />
        ))}
      </ol>
      <DrillFront />
    </>
  );
}

function DrillFront() {
  return (
    <section className="mine-front" data-mine="front" aria-labelledby="mine-front-heading">
      <h2 id="mine-front-heading" className="mine-front-head">
        <PixelIcon name="pickaxe" />
        {hu.maps.frontHeading}
      </h2>
      <p className="mine-front-text">{hu.maps.frontText}</p>
      <NewMapLink />
    </section>
  );
}

function MineLayer({
  scope,
  sort,
  rootRef,
}: {
  scope: MapScope;
  sort: MapSort;
  rootRef: RefObject<HTMLDivElement | null>;
}) {
  const { data } = useQuery(mapsQuery(scope));
  const { data: daily } = useQuery(dailyQuery());
  const ids = data?.maps.map((map) => map.id) ?? [];
  const stars = data?.maps.map((map) => map.stars ?? -1).join(",") ?? "";
  const layoutKey = data ? [scope, sort, ids.join(","), stars, daily ? "d" : ""].join("|") : "";
  return (
    <MineBackdrop rootRef={rootRef} mapIds={scope === "all" ? ids : []} layoutKey={layoutKey} />
  );
}

function MapCount({ scope }: { scope: MapScope }) {
  const { data } = useQuery(mapsQuery(scope));
  if (!data) {
    return null;
  }
  const rated = data.maps.filter((map) => map.stars !== null);
  const earned = rated.reduce((sum, map) => sum + (map.stars ?? 0), 0);
  const total = rated.length * MAX_NUGGETS;
  return (
    <>
      {hu.maps.count(data.maps.length)}
      {total > 0 ? (
        <>
          {" · "}
          <span className="maps-stars" title={hu.game.nuggetsTotalLabel}>
            <PixelSprite sprite={TILE_SPRITES.nugget} className="maps-nugget" />
            {hu.game.nuggetsTotal(earned, total)}
          </span>
        </>
      ) : null}
    </>
  );
}

export function MapsPage({ scope, sort, user, onScopeChange, onSortChange }: MapsPageProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  return (
    <Tabs
      selectedKey={scope}
      onSelectionChange={(key) => onScopeChange(key === "mine" ? "mine" : "all")}
    >
      <MineLayer scope={scope} sort={sort} rootRef={rootRef} />
      <div ref={rootRef} className="maps-page" data-theme="tarna">
        <div data-mine="plate">
          <LocationPlate
            name={hu.signs.maps}
            meta={<MapCount scope={scope} />}
            className="maps-plate"
            actions={
              <>
                <TabList aria-label={hu.maps.scopeLabel}>
                  <Tab id="all">{hu.maps.scopeAll}</Tab>
                  <Tab id="mine">{hu.maps.scopeMine}</Tab>
                </TabList>
                <Select
                  label={hu.maps.sortLabel}
                  isLabelHidden
                  value={sort}
                  options={SORT_OPTIONS}
                  onChange={onSortChange}
                />
                <NewMapLink />
              </>
            }
          />
        </div>
        <TabPanel id="all">
          {scope === "all" ? (
            <div className="maps-panel">
              <TourPrompt />
              <DailyCard />
              <LevelGrid scope="all" sort={sort} user={user} />
            </div>
          ) : null}
        </TabPanel>
        <TabPanel id="mine">
          {scope === "mine" ? (
            <div className="maps-panel">
              <LevelGrid scope="mine" sort={sort} user={user} />
            </div>
          ) : null}
        </TabPanel>
      </div>
    </Tabs>
  );
}
