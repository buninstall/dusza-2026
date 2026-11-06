import { useQuery } from "@tanstack/react-query";
import { Loading } from "../app/StatusScreens.tsx";
import type { SessionUser } from "../auth/session.ts";
import { EmptyState } from "../components/EmptyState.tsx";
import { LocationPlate } from "../components/LocationPlate.tsx";
import { Notice } from "../components/Notice.tsx";
import { Link } from "../components/ui/Link.tsx";
import { Select } from "../components/ui/Select.tsx";
import { Tab, TabList, TabPanel, Tabs } from "../components/ui/Tabs.tsx";
import { hu } from "../i18n/hu.ts";
import { errorMessage } from "../lib/api.ts";
import { useMediaQuery } from "../lib/useMediaQuery.ts";
import { LevelTile } from "./LevelTile.tsx";
import "./MapsPage.css";
import { type MapScope, mapsQuery } from "./queries.ts";
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
  const { data, error, isPending } = useQuery(mapsQuery(scope));
  const isWide = useMediaQuery("(min-width: 48rem)", true);
  if (error) {
    return <Notice tone="error" title={errorMessage(error, hu.maps.loadFailed)} live="alert" />;
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
    <ol className="lv-shaft" aria-label={hu.maps.listLabel}>
      {sortMaps(data.maps, sort).map((map) => (
        <LevelTile
          key={map.id}
          map={map}
          depth={depthOf.get(map.id) ?? 1}
          box={isWide ? 120 : 64}
          isOwn={map.ownerId === user.id}
          canEdit={map.ownerId === user.id || user.role === "admin"}
        />
      ))}
    </ol>
  );
}

function MapCount({ scope }: { scope: MapScope }) {
  const { data } = useQuery(mapsQuery(scope));
  return data ? hu.maps.count(data.maps.length) : null;
}

export function MapsPage({ scope, sort, user, onScopeChange, onSortChange }: MapsPageProps) {
  return (
    <Tabs
      selectedKey={scope}
      onSelectionChange={(key) => onScopeChange(key === "mine" ? "mine" : "all")}
    >
      <div className="maps-page">
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
        <TabPanel id="all">
          {scope === "all" ? <LevelGrid scope="all" sort={sort} user={user} /> : null}
        </TabPanel>
        <TabPanel id="mine">
          {scope === "mine" ? <LevelGrid scope="mine" sort={sort} user={user} /> : null}
        </TabPanel>
      </div>
    </Tabs>
  );
}
