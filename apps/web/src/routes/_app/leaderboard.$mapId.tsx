import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { clsx } from "clsx";
import { z } from "zod";
import { Notice } from "../../components/Notice.tsx";
import { Link } from "../../components/ui/Link.tsx";
import { Select } from "../../components/ui/Select.tsx";
import { formatTime, hu } from "../../i18n/hu.ts";
import { errorMessage } from "../../lib/api.ts";
import { leaderboardQuery } from "../../map/queries.ts";

const searchSchema = z.object({ version: z.coerce.number().int().positive().optional() });

function LeaderboardPage() {
  const { mapId } = Route.useParams();
  const { version } = Route.useSearch();
  const { user } = Route.useRouteContext();
  const navigate = useNavigate({ from: Route.fullPath });
  const { data, error, isPending } = useQuery(leaderboardQuery(Number(mapId), version));

  if (error) {
    return <Notice tone="error" title={errorMessage(error, hu.app.unexpected)} />;
  }
  if (isPending || !data) {
    return <p className="pt-6 text-ink-muted">{hu.common.loading}</p>;
  }

  const versionOptions = data.versions.map((item) => ({
    id: String(item.id),
    label:
      item.id === data.currentVersionId
        ? `${hu.maps.version(item.version)} (${hu.leaderboard.current})`
        : hu.maps.version(item.version),
  }));

  return (
    <div className="flex flex-col gap-6 pt-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black tracking-tighter">
            {hu.leaderboard.title(data.title)}
          </h1>
          <p className="mt-2 max-w-2xl text-ink-muted">{hu.leaderboard.lead}</p>
        </div>
        <div className="flex items-end gap-3">
          {versionOptions.length > 1 ? (
            <Select
              label={hu.leaderboard.version}
              value={String(data.versionId)}
              options={versionOptions}
              onChange={(next) => void navigate({ search: { version: Number(next) } })}
            />
          ) : null}
          <Link to="/play/$mapId" params={{ mapId }} variant="primary" size="md">
            {hu.maps.play}
          </Link>
        </div>
      </header>

      {data.entries.length === 0 ? (
        <Notice tone="info" title={hu.leaderboard.empty} />
      ) : (
        <div className="plate overflow-x-auto">
          <table className="w-full text-left">
            <caption className="sr-only">{hu.leaderboard.tableLabel}</caption>
            <thead className="eyebrow border-b border-line">
              <tr>
                <th scope="col" className="px-5 py-3 font-medium">
                  {hu.leaderboard.rank}
                </th>
                <th scope="col" className="px-5 py-3 font-medium">
                  {hu.leaderboard.player}
                </th>
                <th scope="col" className="px-5 py-3 text-right font-medium">
                  {hu.leaderboard.gold}
                </th>
                <th scope="col" className="px-5 py-3 text-right font-medium">
                  {hu.leaderboard.steps}
                </th>
                <th scope="col" className="px-5 py-3 font-medium">
                  {hu.leaderboard.when}
                </th>
              </tr>
            </thead>
            <tbody>
              {data.entries.map((entry) => (
                <tr
                  key={entry.runId}
                  className={clsx(
                    "border-b border-line last:border-0",
                    entry.userId === user.id &&
                      "bg-[color-mix(in_oklch,var(--ore)_14%,transparent)]",
                  )}
                >
                  <td className="px-5 py-3 font-mono text-xl font-bold tabular-nums">
                    {entry.rank}.
                  </td>
                  <th scope="row" className="px-5 py-3 font-semibold">
                    {entry.username}
                  </th>
                  <td className="px-5 py-3 text-right font-mono tabular-nums">{entry.gold}</td>
                  <td className="px-5 py-3 text-right font-mono tabular-nums">{entry.steps}</td>
                  <td className="px-5 py-3 text-sm text-ink-muted">
                    {formatTime(entry.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export const Route = createFileRoute("/_app/leaderboard/$mapId")({
  validateSearch: searchSchema,
  component: LeaderboardPage,
});
