import { useQuery } from "@tanstack/react-query";
import "../components/DataTable.css";
import { EmptyState } from "../components/EmptyState.tsx";
import { Led } from "../components/Led.tsx";
import { LoadFailed } from "../components/LoadFailed.tsx";
import { LocationPlate } from "../components/LocationPlate.tsx";
import { Pager } from "../components/Pager.tsx";
import { Link } from "../components/ui/Link.tsx";
import { formatTime, hu } from "../i18n/hu.ts";
import { pager } from "../i18n/hu-pager.ts";
import "./MyRunsPage.css";
import { myRunsQuery, type RunPage, type RunRow } from "./queries.ts";

function outcomeText(run: RunRow): string {
  if (run.outcomeKind === "ok" || run.errorCode === null || run.errorLine === null) {
    return hu.runs.ok;
  }
  return hu.runs.error(run.errorCode, run.errorLine);
}

function RunsTable({ runs }: { runs: readonly RunRow[] }) {
  return (
    <div className="data-table">
      <table className="data-table-grid runs-table">
        <caption className="visually-hidden">{hu.runs.tableLabel}</caption>
        <thead>
          <tr>
            <th scope="col">{hu.runs.when}</th>
            <th scope="col">{hu.runs.map}</th>
            <th scope="col">{hu.runs.version}</th>
            <th scope="col" className="data-table-number">
              {hu.runs.gold}
            </th>
            <th scope="col" className="data-table-number">
              {hu.runs.steps}
            </th>
            <th scope="col">{hu.runs.outcome}</th>
            <th scope="col">
              <span className="visually-hidden">{hu.runs.replay}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => {
            const time = formatTime(run.createdAt);
            return (
              <tr key={run.id}>
                <td className="data-table-muted runs-when">{time}</td>
                <th scope="row">
                  <Link to="/leaderboard/$mapId" params={{ mapId: String(run.mapId) }}>
                    {run.mapTitle}
                  </Link>
                </th>
                <td className="mono">{hu.maps.version(run.version)}</td>
                <td className="data-table-number">{run.gold}</td>
                <td className="data-table-number">{run.steps}</td>
                <td className="runs-outcome" data-outcome={run.outcomeKind}>
                  <Led
                    state={run.outcomeKind === "ok" ? "ok" : "error"}
                    label={outcomeText(run)}
                    isSentenceCase
                  />
                </td>
                <td>
                  <Link
                    to="/runs/$runId"
                    params={{ runId: String(run.id) }}
                    variant="secondary"
                    size="sm"
                    icon="replay"
                    aria-label={hu.runs.replayFor(run.mapTitle, time)}
                  >
                    {hu.runs.replay}
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

type MyRunsPageProps = { page: number; onPageChange: (page: number) => void };

function PagedRuns({
  data,
  isTurning,
  onPageChange,
}: {
  data: RunPage;
  isTurning: boolean;
  onPageChange: (page: number) => void;
}) {
  const from = (data.page - 1) * data.pageSize;
  return (
    <>
      <div aria-busy={isTurning} data-turning={isTurning} className="runs-paged">
        <RunsTable runs={data.runs} />
      </div>
      <div className="runs-pager">
        <p className="runs-range">{pager.range(from + 1, from + data.runs.length, data.total)}</p>
        <Pager page={data.page} pageCount={data.pageCount} onChange={onPageChange} />
      </div>
    </>
  );
}

export function MyRunsPage({ page, onPageChange }: MyRunsPageProps) {
  const { data, error, refetch, isPlaceholderData } = useQuery(myRunsQuery(Math.max(1, page)));
  return (
    <div className="runs-page">
      <LocationPlate name={hu.signs.runs} meta={hu.runs.meta(data?.total ?? null)} />
      {error ? (
        <LoadFailed error={error} fallback={hu.runs.loadFailed} onRetry={() => void refetch()} />
      ) : null}
      {data?.total === 0 ? (
        <div className="runs-empty">
          <EmptyState
            text={hu.runs.empty}
            action={
              <Link to="/maps" variant="primary" icon="grid">
                {hu.runs.toMaps}
              </Link>
            }
          />
        </div>
      ) : null}
      {data && data.total > 0 ? (
        <PagedRuns data={data} isTurning={isPlaceholderData} onPageChange={onPageChange} />
      ) : null}
    </div>
  );
}
