import { type UseQueryResult, useQuery, useQueryClient } from "@tanstack/react-query";
import { Fragment, type ReactNode, type RefObject, useEffect, useRef } from "react";
import type { SessionUser } from "../auth/session.ts";
import { EmptyState } from "../components/EmptyState.tsx";
import { LoadFailed } from "../components/LoadFailed.tsx";
import { LocationPlate } from "../components/LocationPlate.tsx";
import { Link } from "../components/ui/Link.tsx";
import { SearchField } from "../components/ui/SearchField.tsx";
import { Segmented } from "../components/ui/Segmented.tsx";
import { Select } from "../components/ui/Select.tsx";
import { Tab, TabList, TabPanel, Tabs } from "../components/ui/Tabs.tsx";
import { hu } from "../i18n/hu.ts";
import { browse } from "../i18n/hu-browse.ts";
import { story } from "../i18n/hu-story.ts";
import type { IconName } from "../pixel/icons.ts";
import { PixelIcon } from "../pixel/PixelIcon.tsx";
import { TourPrompt } from "../tour/TourPrompt.tsx";
import { ChapterCounter } from "./ChapterPlate.tsx";
import { type Campaign, groupCampaign, isCleared } from "./campaign.ts";
import { DailyCard } from "./DailyCard.tsx";
import { MineBackdrop } from "./deep/MineBackdrop.tsx";
import { LevelTile } from "./LevelTile.tsx";
import "./MapsPage.css";
import {
  DIFFICULTY_FILTERS,
  type DifficultyFilter,
  PLAY_MODES,
  type PlayMode,
  SEARCH_MAX,
} from "./mode.ts";
import {
  dailyQuery,
  type MapPage,
  type MapScope,
  type MapSummary,
  prefetchSandboxPage,
  type SandboxParams,
  sandboxQuery,
  sandboxStatsQuery,
  storyMapsQuery,
} from "./queries.ts";
import { SandboxBrowser } from "./SandboxBrowser.tsx";
import { MAP_SORTS, type MapSort, sortMaps } from "./sort.ts";

type MapsPageProps = {
  mode: PlayMode;
  scope: MapScope;
  sort: MapSort;
  difficulty: DifficultyFilter;
  page: number;
  q: string;
  user: SessionUser;
  onModeChange: (mode: PlayMode) => void;
  onScopeChange: (scope: MapScope) => void;
  onSortChange: (sort: MapSort) => void;
  onDifficultyChange: (difficulty: DifficultyFilter) => void;
  onPageChange: (page: number) => void;
  onSearch: (q: string) => void;
};

const SORT_ORDER: readonly MapSort[] = ["recent", ...MAP_SORTS.filter((id) => id !== "recent")];
const SORT_LABELS: Record<MapSort, string> = { ...hu.maps.sorts, popular: browse.popular };
const SORT_OPTIONS = SORT_ORDER.map((id) => ({ id, label: SORT_LABELS[id] }));
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

function StoryState({ children }: { children: (maps: readonly MapSummary[]) => ReactNode }) {
  const { data, error, isPending, refetch } = useQuery(storyMapsQuery());
  if (error) {
    return (
      <LoadFailed error={error} fallback={hu.maps.loadFailed} onRetry={() => void refetch()} />
    );
  }
  if (isPending) {
    return null;
  }
  return children(data.maps);
}

function useStorySilence(): boolean {
  const { data } = useQuery(storyMapsQuery());
  return groupCampaign(sortMaps(data?.maps ?? [], "order")).isSilent;
}

type SandboxPanelProps = {
  params: SandboxParams;
  result: UseQueryResult<MapPage>;
  user: SessionUser;
  onPageChange: (page: number) => void;
  onSearch: (q: string) => void;
};

function SandboxPanel({ params, result, user, onPageChange, onSearch }: SandboxPanelProps) {
  const isSilent = useStorySilence();
  return (
    <>
      <SandboxBrowser
        params={params}
        result={result}
        user={user}
        onPageChange={onPageChange}
        onClearSearch={() => onSearch("")}
      />
      <DrillFront isSilent={isSilent} />
    </>
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
    <StoryState>
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
    </StoryState>
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
  params,
  rootRef,
}: {
  mode: PlayMode;
  params: SandboxParams;
  rootRef: RefObject<HTMLDivElement | null>;
}) {
  const isStory = mode === "story";
  const storyList = useQuery({ ...storyMapsQuery(), enabled: isStory });
  const sandboxPage = useQuery({ ...sandboxQuery(params), enabled: !isStory });
  const { data: daily } = useQuery(dailyQuery());
  const shown = isStory ? storyList.data?.maps : sandboxPage.data?.maps;
  const ids = isStory ? storyMapIds(shown ?? []) : (shown ?? []).map((map) => map.id);
  const stars = shown?.map((map) => map.stars ?? -1).join(",") ?? "";
  const hasDaily = !isStory && params.scope === "all" && daily;
  const layoutKey = shown
    ? [
        mode,
        params.scope,
        params.sort,
        params.level,
        params.q,
        sandboxPage.data?.page ?? 0,
        ids.join(","),
        stars,
        hasDaily ? "d" : "",
      ].join("|")
    : "";
  const digIds = isStory || params.scope === "all" ? ids : [];
  return (
    <MineBackdrop
      rootRef={rootRef}
      mapIds={digIds}
      layoutKey={layoutKey}
      seenKey={isStory ? "minescript.mine.seen.story" : "minescript.mine.seen"}
    />
  );
}

function SandboxStats() {
  const { data } = useQuery(sandboxStatsQuery());
  return (
    <p className="maps-progress maps-stats">
      <PixelIcon name="list" />
      <span className="maps-stats-lines">
        <span className="maps-stat">
          <span className="maps-stat-value">{data?.maps ?? 0}</span> {story.sandboxMaps}
        </span>
        <span className="maps-stats-sep" aria-hidden="true">
          ·
        </span>
        <span className="maps-stat">
          <span className="maps-stat-value">{data?.authors ?? 0}</span> {story.sandboxAuthors}
        </span>
      </span>
    </p>
  );
}

function useStoryStatus() {
  const { data } = useQuery(storyMapsQuery());
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

function SandboxPlate({
  sort,
  difficulty,
  q,
  onModeChange,
  onSortChange,
  onDifficultyChange,
  onSearch,
  onScopeIntent,
}: Pick<
  MapsPageProps,
  "sort" | "difficulty" | "q" | "onModeChange" | "onSortChange" | "onDifficultyChange" | "onSearch"
> & { onScopeIntent: (scope: MapScope) => void }) {
  return (
    <div className="maps-plate-grid">
      <ModeSwitch mode="sandbox" onChange={onModeChange} />
      <SandboxStats />
      <NewMapLink isCompact />
      <TabList aria-label={hu.maps.scopeLabel}>
        <Tab id="all" onHoverStart={() => onScopeIntent("all")}>
          {hu.maps.scopeAll}
        </Tab>
        <Tab id="mine" onHoverStart={() => onScopeIntent("mine")}>
          {hu.maps.scopeMine}
        </Tab>
        <Tab id="favorites" onHoverStart={() => onScopeIntent("favorites")}>
          {browse.scopeFavorites}
        </Tab>
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
      <SearchField
        className="maps-search"
        label={browse.searchLabel}
        clearLabel={browse.searchClear}
        placeholder={browse.searchPlaceholder}
        isLabelHidden
        maxLength={SEARCH_MAX}
        value={q}
        onCommit={onSearch}
      />
    </div>
  );
}

const SCOPES: readonly MapScope[] = ["all", "mine", "favorites"];
const IDLE_PREFETCH_MS = 600;

export function MapsPage({
  mode,
  scope,
  sort,
  difficulty,
  page,
  q,
  user,
  onModeChange,
  onScopeChange,
  onSortChange,
  onDifficultyChange,
  onPageChange,
  onSearch,
}: MapsPageProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const params: SandboxParams = { scope, q, sort, level: difficulty, page };
  const isStory = mode === "story";
  const sandbox = useQuery({ ...sandboxQuery(params), enabled: !isStory });
  const sandboxKey = JSON.stringify(params);

  useEffect(() => {
    if (!isStory) {
      return;
    }
    const prefetch = () => {
      prefetchSandboxPage(queryClient, JSON.parse(sandboxKey) as SandboxParams);
      void queryClient.prefetchQuery(sandboxStatsQuery());
      void queryClient.prefetchQuery(dailyQuery());
    };
    const timer = window.setTimeout(prefetch, IDLE_PREFETCH_MS);
    return () => window.clearTimeout(timer);
  }, [isStory, sandboxKey, queryClient]);

  if (isStory) {
    return (
      <>
        <StoryPage user={user} onModeChange={onModeChange} rootRef={rootRef} />
        <MineLayer mode={mode} params={params} rootRef={rootRef} />
      </>
    );
  }
  return (
    <Tabs
      selectedKey={scope}
      onSelectionChange={(key) => onScopeChange(SCOPES.find((id) => id === key) ?? "all")}
    >
      <div ref={rootRef} className="maps-page" data-theme="tarna" data-mode="sandbox">
        <div data-mine="plate">
          <LocationPlate
            name={hu.signs.maps}
            className="maps-plate maps-plate-sandbox"
            actions={
              <SandboxPlate
                sort={sort}
                difficulty={difficulty}
                q={q}
                onModeChange={onModeChange}
                onSortChange={onSortChange}
                onDifficultyChange={onDifficultyChange}
                onSearch={onSearch}
                onScopeIntent={(next) => {
                  if (next !== scope) {
                    prefetchSandboxPage(queryClient, { ...params, scope: next, page: 1 });
                  }
                }}
              />
            }
          />
        </div>
        {SCOPES.map((id) => (
          <TabPanel key={id} id={id}>
            {scope === id ? (
              <div className="maps-panel">
                {id === "all" ? (
                  <>
                    <TourPrompt />
                    <DailyCard />
                  </>
                ) : null}
                <SandboxPanel
                  params={params}
                  result={sandbox}
                  user={user}
                  onPageChange={onPageChange}
                  onSearch={onSearch}
                />
              </div>
            ) : null}
          </TabPanel>
        ))}
      </div>
      <MineLayer mode={mode} params={params} rootRef={rootRef} />
    </Tabs>
  );
}
