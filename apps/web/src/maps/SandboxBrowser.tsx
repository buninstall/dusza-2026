import { type UseQueryResult, useQueryClient } from "@tanstack/react-query";
import { type CSSProperties, useEffect, useId, useRef } from "react";
import type { SessionUser } from "../auth/session.ts";
import { EmptyState } from "../components/EmptyState.tsx";
import { LoadFailed } from "../components/LoadFailed.tsx";
import { Pager } from "../components/Pager.tsx";
import { Button } from "../components/ui/Button.tsx";
import { hu } from "../i18n/hu.ts";
import { browse } from "../i18n/hu-browse.ts";
import { story } from "../i18n/hu-story.ts";
import { LevelTile } from "./LevelTile.tsx";
import { type MapPage, prefetchSandboxPage, type SandboxParams } from "./queries.ts";
import { usePageTurn } from "./usePageTurn.ts";
import "./SandboxBrowser.css";

type SandboxBrowserProps = {
  params: SandboxParams;
  result: UseQueryResult<MapPage>;
  user: SessionUser;
  onPageChange: (page: number) => void;
  onClearSearch: () => void;
};

function emptyText(params: SandboxParams): string {
  if (params.q.length > 0) {
    return browse.noSearchMatch(params.q);
  }
  if (params.level !== "all") {
    return story.noMatch;
  }
  if (params.scope === "favorites") {
    return browse.emptyFavorites;
  }
  return params.scope === "mine" ? hu.maps.emptyMine : hu.maps.empty;
}

function rangeOf(data: MapPage): { from: number; to: number } {
  const from = (data.page - 1) * data.pageSize + 1;
  return { from, to: from + data.maps.length - 1 };
}

export function SandboxBrowser({
  params,
  result,
  user,
  onPageChange,
  onClearSearch,
}: SandboxBrowserProps) {
  const queryClient = useQueryClient();
  const { data, error, isPlaceholderData, refetch } = result;
  const rangeId = useId();
  const anchorRef = useRef<HTMLDivElement>(null);
  const regionRef = useRef<HTMLOListElement>(null);
  const isSettled = data !== undefined && !isPlaceholderData;
  const { direction, turnTo } = usePageTurn({
    page: data?.page ?? 0,
    isSettled,
    anchorRef,
    regionRef,
    onPageChange,
  });
  const nextPage = data && isSettled && data.page < data.pageCount ? data.page + 1 : null;

  useEffect(() => {
    if (nextPage !== null) {
      prefetchSandboxPage(queryClient, { ...params, page: nextPage });
    }
  }, [nextPage, params, queryClient]);

  if (error) {
    return (
      <LoadFailed error={error} fallback={hu.maps.loadFailed} onRetry={() => void refetch()} />
    );
  }
  if (!data) {
    return null;
  }
  if (data.total === 0 && !isSettled) {
    return (
      <p className="lv-more-count" role="status" aria-busy="true">
        {browse.loading}
      </p>
    );
  }
  if (data.total === 0) {
    const clear =
      params.q.length > 0 ? (
        <Button icon="close" onPress={onClearSearch}>
          {browse.searchClear}
        </Button>
      ) : null;
    return <EmptyState text={emptyText(params)} action={clear} />;
  }
  const { from, to } = rangeOf(data);
  const status = isSettled
    ? browse.pageAnnounce(data.page, data.pageCount, data.total)
    : browse.loading;
  return (
    <div className="sb">
      <div ref={anchorRef} className="sb-anchor" />
      <ol
        key={`${data.page}|${data.maps.map((map) => map.id).join(",")}`}
        ref={regionRef}
        tabIndex={-1}
        className="lv-shaft sb-shaft"
        aria-label={hu.maps.listLabel}
        aria-describedby={rangeId}
        aria-busy={!isSettled}
        data-turning={!isSettled}
        data-direction={direction}
      >
        {data.maps.map((map, index) => (
          <LevelTile
            key={map.id}
            map={map}
            depth={1}
            box={84}
            canEdit={map.ownerId === user.id || user.role === "admin"}
            headingLevel={2}
            hasDepth={false}
            hasFavorite
            style={{ "--i": index } as CSSProperties}
          />
        ))}
      </ol>
      <div className="lv-more sb-pager">
        <p id={rangeId} className="lv-more-count">
          {data.pageCount > 1
            ? `${browse.range(from, to, data.total)} · ${browse.pageLabel(data.page, data.pageCount)}`
            : browse.range(from, to, data.total)}
        </p>
        <Pager
          page={data.page}
          pageCount={data.pageCount}
          onChange={turnTo}
          onIntent={(page) => prefetchSandboxPage(queryClient, { ...params, page })}
        />
      </div>
      <p className="visually-hidden" role="status">
        {status}
      </p>
    </div>
  );
}
