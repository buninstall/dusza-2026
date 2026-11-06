import { useQuery } from "@tanstack/react-query";
import { Loading } from "../app/StatusScreens.tsx";
import "../components/DataTable.css";
import { EmptyState } from "../components/EmptyState.tsx";
import { Led } from "../components/Led.tsx";
import { LocationPlate } from "../components/LocationPlate.tsx";
import { Notice } from "../components/Notice.tsx";
import { Link } from "../components/ui/Link.tsx";
import { formatTime, hu } from "../i18n/hu.ts";
import { errorMessage } from "../lib/api.ts";
import "./MyRunsPage.css";
import { myRunsQuery, type RunRow } from "./queries.ts";

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

export function MyRunsPage() {
  const { data, error } = useQuery(myRunsQuery);
  return (
    <div className="runs-page">
      <LocationPlate name={hu.signs.runs} meta={hu.runs.meta} />
      {error ? (
        <Notice tone="error" title={errorMessage(error, hu.runs.loadFailed)} live="alert" />
      ) : null}
      {!data && !error ? <Loading /> : null}
      {data?.runs.length === 0 ? (
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
      {data && data.runs.length > 0 ? <RunsTable runs={data.runs} /> : null}
    </div>
  );
}
