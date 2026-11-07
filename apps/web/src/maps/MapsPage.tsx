import { useQuery } from "@tanstack/react-query";
import { type ReactNode, type RefObject, useRef } from "react";
import { Loading } from "../app/StatusScreens.tsx";
import type { SessionUser } from "../auth/session.ts";
import { EmptyState } from "../components/EmptyState.tsx";
import { LoadFailed } from "../components/LoadFailed.tsx";
import { LocationPlate } from "../components/LocationPlate.tsx";
import { Link } from "../components/ui/Link.tsx";
import { Segmented } from "../components/ui/Segmented.tsx";
import { Select } from "../components/ui/Select.tsx";
import { Tab, TabList, TabPanel, Tabs } from "../components/ui/Tabs.tsx";
import { hu } from "../i18n/hu.ts";
import { story } from "../i18n/hu-story.ts";
import { PixelIcon } from "../pixel/PixelIcon.tsx";
import { TourPrompt } from "../tour/TourPrompt.tsx";
import { ChapterSign, EpilogueSign } from "./ChapterPlate.tsx";
import { type Campaign, groupCampaign, isCampaignMap, STRATUM_INDEX } from "./campaign.ts";
import { DailyCard } from "./DailyCard.tsx";
import { MineBackdrop } from "./deep/MineBackdrop.tsx";
import { LevelTile } from "./LevelTile.tsx";
import "./MapsPage.css";
import { PLAY_MODES, type PlayMode } from "./mode.ts";
import { dailyQuery, type MapScope, type MapSummary, mapsQuery } from "./queries.ts";
import { MAP_SORTS, type MapSort, sortMaps } from "./sort.ts";

type MapsPageProps = {
  mode: PlayMode;
  scope: MapScope;
  sort: MapSort;
  user: SessionUser;
  onModeChange: (mode: PlayMode) => void;
  onScopeChange: (scope: MapScope) => void;
  onSortChange: (sort: MapSort) => void;
};

const SORT_OPTIONS = MAP_SORTS.map((id) => ({ id, label: hu.maps.sorts[id] }));
const MODE_OPTIONS = PLAY_MODES.map((id) => ({
  id,
  label: story.modes[id],
  icon: id === "story" ? ("book" as const) : ("pickaxe" as const),
}));

function NewMapLink({ isCompact = false }: { isCompact?: boolean }) {
  return (
    <Link to="/maps/new" variant="primary" icon="pickaxe" size={isCompact ? "sm" : "md"}>
      {hu.maps.newMap}
    </Link>
  );
}

function ModeSwitch({ mode, onChange }: { mode: PlayMode; onChange: (mode: PlayMode) => void }) {
  return (
    <div className="maps-mode">
      <Segmented
        label={story.modeLabel}
        isLabelHidden
        value={mode}
        options={MODE_OPTIONS}
        onChange={onChange}
      />
    </div>
  );
}

type ShaftProps = {
  maps: readonly MapSummary[];
  depthOf: ReadonlyMap<number, number>;
  user: SessionUser;
  label: string;
  headingLevel: 2 | 3;
  isLocked?: boolean;
};

function Shaft({ maps, depthOf, user, label, headingLevel, isLocked = false }: ShaftProps) {
  return (
    <ol className="lv-shaft" aria-label={label}>
      {maps.map((map) => (
        <LevelTile
          key={map.id}
          map={map}
          depth={depthOf.get(map.id) ?? 1}
          box={84}
          canEdit={map.ownerId === user.id || user.role === "admin"}
          headingLevel={headingLevel}
          isLocked={isLocked}
        />
      ))}
    </ol>
  );
}

function depthsOf(maps: readonly MapSummary[]): Map<number, number> {
  return new Map(sortMaps(maps, "order").map((map, index) => [map.id, index + 1]));
}

function useMapList(scope: MapScope) {
  return useQuery(mapsQuery(scope));
}

function ListState({
  scope,
  children,
}: {
  scope: MapScope;
  children: (maps: readonly MapSummary[]) => ReactNode;
}) {
  const { data, error, isPending, refetch } = useMapList(scope);
  if (error) {
    return (
      <LoadFailed error={error} fallback={hu.maps.loadFailed} onRetry={() => void refetch()} />
    );
  }
  if (isPending) {
    return <Loading />;
  }
  return children(data.maps);
}

function sandboxMaps(maps: readonly MapSummary[]): MapSummary[] {
  return maps.filter((map) => !isCampaignMap(map));
}

function SandboxGrid({ scope, sort, user }: { scope: MapScope; sort: MapSort; user: SessionUser }) {
  return (
    <ListState scope={scope}>
      {(all) => {
        const maps = sandboxMaps(all);
        return maps.length === 0 ? (
          <EmptyState
            text={scope === "mine" ? hu.maps.emptyMine : hu.maps.empty}
            action={<NewMapLink />}
          />
        ) : (
          <>
            <Shaft
              maps={sortMaps(maps, sort)}
              depthOf={depthsOf(maps)}
              user={user}
              label={hu.maps.listLabel}
              headingLevel={2}
            />
            <DrillFront isSilent={groupCampaign(sortMaps(all, "order")).isSilent} />
          </>
        );
      }}
    </ListState>
  );
}

function StoryChapters({ campaign, user }: { campaign: Campaign; user: SessionUser }) {
  const visible = campaign.groups.flatMap((group) => group.maps);
  const depthOf = new Map(visible.map((map, index) => [map.id, index + 1]));
  const last = campaign.groups.at(-1);
  return (
    <div className="ch-campaign">
      {campaign.groups.map((group, index) => {
        const headingId = `ch-title-${index + 1}`;
        return (
          <section key={group.chapter.numeral} className="ch-section" aria-labelledby={headingId}>
            <ChapterSign group={group} headingId={headingId} />
            <Shaft
              maps={group.maps}
              depthOf={depthOf}
              user={user}
              label={story.chapterLevels(group.chapter.numeral)}
              headingLevel={3}
              isLocked={group.lock !== null}
            />
          </section>
        );
      })}
      {campaign.isSilent && last ? (
        <EpilogueSign stratum={STRATUM_INDEX[last.chapter.stratum]} />
      ) : null}
    </div>
  );
}

function StoryGrid({ user }: { user: SessionUser }) {
  return (
    <ListState scope="all">
      {(maps) => {
        const campaign = groupCampaign(sortMaps(maps, "order"));
        if (campaign.groups.length === 0) {
          return <EmptyState text={hu.maps.empty} action={null} />;
        }
        return (
          <>
            <StoryChapters campaign={campaign} user={user} />
            <DrillFront isSilent={campaign.isSilent} isStory />
          </>
        );
      }}
    </ListState>
  );
}

function DrillFront({ isSilent, isStory = false }: { isSilent: boolean; isStory?: boolean }) {
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
      <p className="mine-front-text">
        {isStory ? (isSilent ? story.frontSilent : story.frontStory) : hu.maps.frontText}
      </p>
      {isStory ? <StoryBoardLink /> : <NewMapLink />}
    </section>
  );
}

function StoryBoardLink({ isCompact = false }: { isCompact?: boolean }) {
  return (
    <Link to="/story/leaderboard" variant="secondary" icon="trophy" size={isCompact ? "sm" : "md"}>
      {story.leaderboard}
    </Link>
  );
}

function storyMapIds(maps: readonly MapSummary[]): number[] {
  return groupCampaign(sortMaps(maps, "order")).groups.flatMap((group) =>
    group.lock ? [] : group.maps.map((map) => map.id),
  );
}

function MineLayer({
  mode,
  scope,
  sort,
  rootRef,
}: {
  mode: PlayMode;
  scope: MapScope;
  sort: MapSort;
  rootRef: RefObject<HTMLDivElement | null>;
}) {
  const listScope = mode === "story" ? "all" : scope;
  const { data } = useQuery(mapsQuery(listScope));
  const { data: daily } = useQuery(dailyQuery());
  const ids =
    mode === "story"
      ? storyMapIds(data?.maps ?? [])
      : sandboxMaps(data?.maps ?? []).map((map) => map.id);
  const stars = data?.maps.map((map) => map.stars ?? -1).join(",") ?? "";
  const hasDaily = mode === "sandbox" && scope === "all" && daily;
  const layoutKey = data
    ? [mode, scope, sort, ids.join(","), stars, hasDaily ? "d" : ""].join("|")
    : "";
  const digIds = mode === "story" || scope === "all" ? ids : [];
  return (
    <MineBackdrop
      rootRef={rootRef}
      mapIds={digIds}
      layoutKey={layoutKey}
      seenKey={mode === "story" ? "minescript.mine.seen.story" : "minescript.mine.seen"}
    />
  );
}

function StoryPage({
  user,
  onModeChange,
  rootRef,
}: {
  user: SessionUser;
  onModeChange: (mode: PlayMode) => void;
  rootRef: RefObject<HTMLDivElement | null>;
}) {
  return (
    <div ref={rootRef} className="maps-page" data-theme="tarna" data-mode="story">
      <div data-mine="plate">
        <LocationPlate
          name={hu.signs.maps}
          className="maps-plate"
          actions={
            <>
              <ModeSwitch mode="story" onChange={onModeChange} />
              <StoryBoardLink isCompact />
            </>
          }
        />
      </div>
      <div className="maps-panel">
        <TourPrompt />
        <StoryGrid user={user} />
      </div>
    </div>
  );
}

export function MapsPage({
  mode,
  scope,
  sort,
  user,
  onModeChange,
  onScopeChange,
  onSortChange,
}: MapsPageProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  if (mode === "story") {
    return (
      <>
        <StoryPage user={user} onModeChange={onModeChange} rootRef={rootRef} />
        <MineLayer mode={mode} scope={scope} sort={sort} rootRef={rootRef} />
      </>
    );
  }
  return (
    <Tabs
      selectedKey={scope}
      onSelectionChange={(key) => onScopeChange(key === "mine" ? "mine" : "all")}
    >
      <div ref={rootRef} className="maps-page" data-theme="tarna" data-mode="sandbox">
        <div data-mine="plate">
          <LocationPlate
            name={hu.signs.maps}
            className="maps-plate"
            actions={
              <>
                <ModeSwitch mode="sandbox" onChange={onModeChange} />
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
                <NewMapLink isCompact />
              </>
            }
          />
        </div>
        <TabPanel id="all">
          {scope === "all" ? (
            <div className="maps-panel">
              <TourPrompt />
              <DailyCard />
              <SandboxGrid scope="all" sort={sort} user={user} />
            </div>
          ) : null}
        </TabPanel>
        <TabPanel id="mine">
          {scope === "mine" ? (
            <div className="maps-panel">
              <SandboxGrid scope="mine" sort={sort} user={user} />
            </div>
          ) : null}
        </TabPanel>
      </div>
      <MineLayer mode={mode} scope={scope} sort={sort} rootRef={rootRef} />
    </Tabs>
  );
}
