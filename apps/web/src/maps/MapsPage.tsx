import { useQuery } from "@tanstack/react-query";
import { Fragment, type ReactNode, type RefObject, useRef, useState } from "react";
import { Loading } from "../app/StatusScreens.tsx";
import type { SessionUser } from "../auth/session.ts";
import { EmptyState } from "../components/EmptyState.tsx";
import { LoadFailed } from "../components/LoadFailed.tsx";
import { LocationPlate } from "../components/LocationPlate.tsx";
import { Button } from "../components/ui/Button.tsx";
import { Link } from "../components/ui/Link.tsx";
import { Segmented } from "../components/ui/Segmented.tsx";
import { Select } from "../components/ui/Select.tsx";
import { Tab, TabList, TabPanel, Tabs } from "../components/ui/Tabs.tsx";
import { hu } from "../i18n/hu.ts";
import { story } from "../i18n/hu-story.ts";
import type { IconName } from "../pixel/icons.ts";
import { PixelIcon } from "../pixel/PixelIcon.tsx";
import { TourPrompt } from "../tour/TourPrompt.tsx";
import { ChapterCounter } from "./ChapterPlate.tsx";
import { type Campaign, groupCampaign, isCampaignMap, isCleared } from "./campaign.ts";
import { DailyCard } from "./DailyCard.tsx";
import { MineBackdrop } from "./deep/MineBackdrop.tsx";
import { LevelTile } from "./LevelTile.tsx";
import "./MapsPage.css";
import {
  DIFFICULTY_FILTERS,
  type DifficultyFilter,
  PLAY_MODES,
  type PlayMode,
  SANDBOX_PAGE,
} from "./mode.ts";
import { dailyQuery, type MapScope, type MapSummary, mapsQuery } from "./queries.ts";
import { MAP_SORTS, type MapSort, sortMaps } from "./sort.ts";

type MapsPageProps = {
  mode: PlayMode;
  scope: MapScope;
  sort: MapSort;
  difficulty: DifficultyFilter;
  user: SessionUser;
  onModeChange: (mode: PlayMode) => void;
  onScopeChange: (scope: MapScope) => void;
  onSortChange: (sort: MapSort) => void;
  onDifficultyChange: (difficulty: DifficultyFilter) => void;
};

const SORT_ORDER: readonly MapSort[] = ["recent", ...MAP_SORTS.filter((id) => id !== "recent")];
const SORT_OPTIONS = SORT_ORDER.map((id) => ({ id, label: hu.maps.sorts[id] }));
const DIFFICULTY_OPTIONS = DIFFICULTY_FILTERS.map((id) => ({
  id,
  label: story.difficulties[id],
}));
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
  hasDepth?: boolean;
};

function Shaft({
  maps,
  depthOf,
  user,
  label,
  headingLevel,
  isLocked = false,
  hasDepth = true,
}: ShaftProps) {
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
          hasDepth={hasDepth}
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

type SandboxGridProps = {
  scope: MapScope;
  sort: MapSort;
  difficulty: DifficultyFilter;
  user: SessionUser;
};

function SandboxShaft({
  maps,
  all,
  user,
}: {
  maps: MapSummary[];
  all: readonly MapSummary[];
  user: SessionUser;
}) {
  const [visible, setVisible] = useState(SANDBOX_PAGE);
  const shown = maps.slice(0, visible);
  const rest = maps.length - shown.length;
  return (
    <>
      <Shaft
        maps={shown}
        depthOf={depthsOf(all)}
        user={user}
        label={hu.maps.listLabel}
        headingLevel={2}
        hasDepth={false}
      />
      <div className="lv-more">
        <p className="lv-more-count">{story.shown(shown.length, maps.length)}</p>
        {rest > 0 ? (
          <Button icon="arrowDown" onPress={() => setVisible((count) => count + SANDBOX_PAGE)}>
            {story.more(rest)}
          </Button>
        ) : null}
      </div>
    </>
  );
}

function SandboxGrid({ scope, sort, difficulty, user }: SandboxGridProps) {
  return (
    <ListState scope={scope}>
      {(all) => {
        const sandbox = sandboxMaps(all);
        const maps = sortMaps(
          sandbox.filter((map) => difficulty === "all" || map.difficulty === difficulty),
          sort,
        );
        const silent = groupCampaign(sortMaps(all, "order")).isSilent;
        if (sandbox.length === 0) {
          return (
            <>
              <EmptyState text={scope === "mine" ? hu.maps.emptyMine : hu.maps.empty} />
              <DrillFront isSilent={silent} />
            </>
          );
        }
        return (
          <>
            {maps.length === 0 ? (
              <EmptyState text={story.noMatch} />
            ) : (
              <SandboxShaft
                key={`${scope}|${sort}|${difficulty}`}
                maps={maps}
                all={sandbox}
                user={user}
              />
            )}
            <DrillFront isSilent={silent} />
          </>
        );
      }}
    </ListState>
  );
}

function StoryChapters({ campaign, user }: { campaign: Campaign; user: SessionUser }) {
  const ordered = campaign.groups.flatMap((group) => group.maps);
  const depthOf = new Map(ordered.map((map, index): [number, number] => [map.id, index + 1]));
  return (
    <div className="ch-campaign">
      {campaign.groups.map((group, index) => (
        <Fragment key={group.chapter.numeral}>
          {index > 0 ? <ChapterCounter chapter={group.chapter} lock={group.lock} /> : null}
          <Shaft
            maps={group.maps}
            depthOf={depthOf}
            user={user}
            label={story.chapterLevels(group.chapter.numeral)}
            headingLevel={2}
            isLocked={group.lock !== null}
          />
        </Fragment>
      ))}
    </div>
  );
}

function StoryGrid({ user }: { user: SessionUser }) {
  return (
    <ListState scope="all">
      {(maps) => {
        const campaign = groupCampaign(sortMaps(maps, "order"));
        if (campaign.groups.length === 0) {
          return (
            <>
              <EmptyState text={hu.maps.empty} />
              <DrillFront isSilent={false} isStory />
            </>
          );
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
    <Link
      to="/story/leaderboard"
      variant="secondary"
      icon="trophy"
      size={isCompact ? "sm" : "md"}
      {...(isCompact ? { "aria-label": story.leaderboardShortLabel } : {})}
    >
      {isCompact ? hu.maps.leaderboard : story.leaderboard}
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

function SandboxStats() {
  const { data } = useQuery(mapsQuery("all"));
  const maps = sandboxMaps(data?.maps ?? []);
  const authors = new Set(maps.map((map) => map.ownerId)).size;
  return <StoryStatusChip icon="list" text={story.sandboxStats(maps.length, authors)} />;
}

function useStoryStatus() {
  const { data } = useQuery(mapsQuery("all"));
  const campaign = groupCampaign(sortMaps(data?.maps ?? [], "order"));
  const maps = campaign.groups.flatMap((group) => group.maps);
  const open = campaign.groups.filter((group) => group.lock === null);
  return {
    total: maps.length,
    cleared: campaign.groups.reduce((sum, group) => sum + group.cleared, 0),
    stars: maps.reduce((sum, map) => sum + Math.max(0, map.stars ?? 0), 0),
    chapter: open.at(-1)?.chapter ?? null,
    next: open.flatMap((group) => group.maps).find((map) => !isCleared(map)) ?? null,
  };
}

function StoryStatusChip({ icon, text }: { icon: IconName; text: string }) {
  return (
    <p className="maps-progress" title={text}>
      <PixelIcon name={icon} />
      <span className="maps-progress-text">{text}</span>
    </p>
  );
}

function ContinueLink({ map }: { map: MapSummary | null }) {
  if (!map) {
    return <StoryStatusChip icon="check" text={story.allDone} />;
  }
  return (
    <Link
      to="/play/$mapId"
      params={{ mapId: String(map.id) }}
      variant="primary"
      icon="play"
      size="sm"
      aria-label={story.continueLabel(map.title)}
    >
      {story.continue}
    </Link>
  );
}

function StoryPlateActions({ onModeChange }: { onModeChange: (mode: PlayMode) => void }) {
  const status = useStoryStatus();
  return (
    <div className="maps-plate-grid">
      <ModeSwitch mode="story" onChange={onModeChange} />
      <StoryStatusChip icon="trophy" text={story.nuggetTotal(status.stars, status.total * 3)} />
      <StoryBoardLink isCompact />
      <StoryStatusChip icon="pickaxe" text={story.progress(status.cleared, status.total)} />
      <StoryStatusChip
        icon="book"
        text={status.chapter ? status.chapter.title : story.modes.story}
      />
      <ContinueLink map={status.next} />
    </div>
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
          actions={<StoryPlateActions onModeChange={onModeChange} />}
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
  difficulty,
  user,
  onModeChange,
  onScopeChange,
  onSortChange,
  onDifficultyChange,
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
                <div className="maps-plate-grid">
                  <ModeSwitch mode="sandbox" onChange={onModeChange} />
                  <SandboxStats />
                  <NewMapLink isCompact />
                  <TabList aria-label={hu.maps.scopeLabel}>
                    <Tab id="all">{hu.maps.scopeAll}</Tab>
                    <Tab id="mine">{hu.maps.scopeMine}</Tab>
                  </TabList>
                  <Select
                    label={story.difficultyLabel}
                    isLabelHidden
                    value={difficulty}
                    options={DIFFICULTY_OPTIONS}
                    onChange={onDifficultyChange}
                  />
                  <Select
                    label={hu.maps.sortLabel}
                    isLabelHidden
                    value={sort}
                    options={SORT_OPTIONS}
                    onChange={onSortChange}
                  />
                </div>
              </>
            }
          />
        </div>
        <TabPanel id="all">
          {scope === "all" ? (
            <div className="maps-panel">
              <TourPrompt />
              <DailyCard />
              <SandboxGrid scope="all" sort={sort} difficulty={difficulty} user={user} />
            </div>
          ) : null}
        </TabPanel>
        <TabPanel id="mine">
          {scope === "mine" ? (
            <div className="maps-panel">
              <SandboxGrid scope="mine" sort={sort} difficulty={difficulty} user={user} />
            </div>
          ) : null}
        </TabPanel>
      </div>
      <MineLayer mode={mode} scope={scope} sort={sort} rootRef={rootRef} />
    </Tabs>
  );
}
