import { queryOptions, useQuery } from "@tanstack/react-query";
import { Loading } from "../app/StatusScreens.tsx";
import "../components/DataTable.css";
import { LocationPlate } from "../components/LocationPlate.tsx";
import { Notice } from "../components/Notice.tsx";
import { Link } from "../components/ui/Link.tsx";
import { formatTime, hu } from "../i18n/hu.ts";
import { api, call, errorMessage } from "../lib/api.ts";
import "./MyRunsPage.css";

const fetchMyRuns = () => call(api.me.runs.$get());

export const myRunsQuery = queryOptions({ queryKey: ["my-runs"], queryFn: fetchMyRuns });

type RunRow = Awaited<ReturnType<typeof fetchMyRuns>>["runs"][number];

function outcomeText(run: RunRow): string {
  if (run.outcomeKind === "ok" || run.errorCode === null || run.errorLine === null) {
    return hu.runs.ok;
  }
  return hu.runs.error(run.errorCode, run.errorLine);
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
      {data?.runs.length === 0 ? <Notice tone="info" title={hu.runs.empty} /> : null}
      {data && data.runs.length > 0 ? (
        <div className="data-table">
          <table className="data-table-grid">
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
              </tr>
            </thead>
            <tbody>
              {data.runs.map((run) => (
                <tr key={run.id}>
                  <td className="data-table-muted">{formatTime(run.createdAt)}</td>
                  <th scope="row">
                    <Link to="/leaderboard/$mapId" params={{ mapId: String(run.mapId) }}>
                      {run.mapTitle}
                    </Link>
                  </th>
                  <td>{hu.maps.version(run.version)}</td>
                  <td className="data-table-number">{run.gold}</td>
                  <td className="data-table-number">{run.steps}</td>
                  <td data-outcome={run.outcomeKind} className="runs-outcome">
                    {outcomeText(run)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
