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
import { hu } from "../i18n/hu.ts";
import { story } from "../i18n/hu-story.ts";
import { PixelIcon } from "../pixel/PixelIcon.tsx";
import { TourPrompt } from "../tour/TourPrompt.tsx";
import { ChapterPlate, EpiloguePlate, OthersPlate } from "./ChapterPlate.tsx";
import { type Campaign, CORE_STRATUM, groupCampaign, STRATUM_INDEX } from "./campaign.ts";
import { DailyCard } from "./DailyCard.tsx";
import { MineBackdrop } from "./deep/MineBackdrop.tsx";
import { LevelTile } from "./LevelTile.tsx";
import "./MapsPage.css";
import { dailyQuery, type MapScope, type MapSummary, mapsQuery } from "./queries.ts";
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

type ShaftProps = {
  maps: readonly MapSummary[];
  depthOf: ReadonlyMap<number, number>;
  user: SessionUser;
  label: string;
  headingLevel?: 2 | 3;
};

function Shaft({ maps, depthOf, user, label, headingLevel }: ShaftProps) {
  return (
    <ol className="lv-shaft" aria-label={label}>
      {maps.map((map) => (
        <LevelTile
          key={map.id}
          map={map}
          depth={depthOf.get(map.id) ?? 1}
          box={84}
          canEdit={map.ownerId === user.id || user.role === "admin"}
          headingLevel={headingLevel ?? 2}
        />
      ))}
    </ol>
  );
}

function CampaignShaft({
  campaign,
  depthOf,
  user,
}: {
  campaign: Campaign;
  depthOf: ReadonlyMap<number, number>;
  user: SessionUser;
}) {
  const last = campaign.groups.at(-1);
  return (
    <div className="ch-campaign">
      {campaign.groups.map((group, index) => {
        const headingId = `ch-title-${index + 1}`;
        return (
          <section key={group.chapter.numeral} className="ch-section" aria-labelledby={headingId}>
            <ChapterPlate group={group} headingId={headingId} />
            <Shaft
              maps={group.maps}
              depthOf={depthOf}
              user={user}
              label={story.chapterLevels(group.chapter.numeral)}
              headingLevel={3}
            />
          </section>
        );
      })}
      {last ? (
        <EpiloguePlate isSilent={campaign.isSilent} stratum={STRATUM_INDEX[last.chapter.stratum]} />
      ) : null}
      {campaign.others.length > 0 ? (
        <section className="ch-section" aria-labelledby="ch-title-others">
          <OthersPlate headingId="ch-title-others" stratum={CORE_STRATUM} />
          <Shaft
            maps={campaign.others}
            depthOf={depthOf}
            user={user}
            label={story.othersHeading}
            headingLevel={3}
          />
        </section>
      ) : null}
    </div>
  );
}

function LevelGrid({ scope, sort, user }: { scope: MapScope; sort: MapSort; user: SessionUser }) {
  const { data, error, isPending, refetch } = useQuery(mapsQuery(scope));
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
  const ordered = sortMaps(data.maps, "order");
  const depthOf = new Map(ordered.map((map, index) => [map.id, index + 1]));
  const campaign = scope === "all" && sort === "order" ? groupCampaign(ordered) : null;
  return (
    <>
      {campaign && campaign.groups.length > 0 ? (
        <CampaignShaft campaign={campaign} depthOf={depthOf} user={user} />
      ) : (
        <Shaft
          maps={sortMaps(data.maps, sort)}
          depthOf={depthOf}
          user={user}
          label={hu.maps.listLabel}
        />
      )}
      <DrillFront isSilent={campaign?.isSilent ?? false} />
    </>
  );
}

function DrillFront({ isSilent }: { isSilent: boolean }) {
  return (
    <section
      className="mine-front"
      data-mine="front"
      data-silent={isSilent}
      aria-labelledby="mine-front-heading"
    >
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

export function MapsPage({ scope, sort, user, onScopeChange, onSortChange }: MapsPageProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  return (
    <Tabs
      selectedKey={scope}
      onSelectionChange={(key) => onScopeChange(key === "mine" ? "mine" : "all")}
    >
      <div ref={rootRef} className="maps-page" data-theme="tarna">
        <div data-mine="plate">
          <LocationPlate
            name={hu.signs.maps}
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
      <MineLayer scope={scope} sort={sort} rootRef={rootRef} />
    </Tabs>
  );
}
