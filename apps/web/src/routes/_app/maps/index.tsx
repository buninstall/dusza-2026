import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { z } from "zod";
import { Notice } from "../../../components/Notice.tsx";
import { Link } from "../../../components/ui/Link.tsx";
import { Tab, TabList, Tabs } from "../../../components/ui/Tabs.tsx";
import { hu } from "../../../i18n/hu.ts";
import { errorMessage } from "../../../lib/api.ts";
import { MiniMap } from "../../../map/MiniMap.tsx";
import { type MapScope, mapsQuery } from "../../../map/queries.ts";

const searchSchema = z.object({ scope: z.enum(["all", "mine"]).default("all") });

function MapsPage() {
  const { scope } = Route.useSearch();
  const { user } = Route.useRouteContext();
  const navigate = useNavigate({ from: Route.fullPath });
  const { data, error, isPending } = useQuery(mapsQuery(scope));

  return (
    <div className="flex flex-col gap-8">
      <section
        aria-labelledby="maps-title"
        className="flex flex-wrap items-end justify-between gap-6 pt-6"
      >
        <div className="max-w-2xl">
          <p className="eyebrow">{hu.app.tagline}</p>
          <h1 id="maps-title" className="mt-2 text-5xl font-black tracking-tighter sm:text-6xl">
            {hu.maps.title}
          </h1>
          <p className="mt-3 text-lg text-ink-muted">{hu.maps.lead}</p>
        </div>
        <Tabs
          selectedKey={scope}
          onSelectionChange={(key) =>
            void navigate({
              search: { scope: (key === "mine" ? "mine" : "all") satisfies MapScope },
            })
          }
        >
          <TabList aria-label={hu.maps.scopeLabel}>
            <Tab id="all">{hu.maps.scopeAll}</Tab>
            <Tab id="mine">{hu.maps.scopeMine}</Tab>
          </TabList>
        </Tabs>
      </section>

      {error ? <Notice tone="error" title={errorMessage(error, hu.maps.loadFailed)} /> : null}
      {isPending ? <p className="text-ink-muted">{hu.common.loading}</p> : null}
      {data && data.maps.length === 0 ? <Notice tone="info" title={hu.maps.empty} /> : null}

      {data && data.maps.length > 0 ? (
        <ol className="flex flex-col divide-y divide-line overflow-hidden rounded-[16px] border border-line bg-paper-raised shadow-plate">
          {data.maps.map((map, index) => (
            <li
              key={map.id}
              className="grid grid-cols-[auto_1fr] items-center gap-x-5 gap-y-3 px-5 py-4 sm:grid-cols-[3rem_auto_1fr_auto]"
            >
              <span
                aria-hidden
                className="hidden font-mono text-3xl font-bold text-line-strong sm:block"
              >
                {String(index + 1).padStart(2, "0")}
              </span>
              <MiniMap content={map.content} />
              <div className="min-w-0">
                <h2 className="flex items-center gap-2 text-lg font-bold">
                  <span className="truncate">{map.title}</span>
                  {map.visibility === "private" ? (
                    <Lock aria-label={hu.maps.private} size={15} className="text-ink-muted" />
                  ) : null}
                </h2>
                <p className="line-clamp-2 text-sm text-ink-muted">{map.description}</p>
                <p className="mt-1 flex flex-wrap gap-x-4 font-mono text-xs text-ink-muted">
                  <span>{hu.maps.size(map.rows, map.cols)}</span>
                  <span>{hu.maps.gold(map.reachableGold, map.goldTotal)}</span>
                  <span>{hu.maps.version(map.version)}</span>
                  <span>{hu.maps.by(map.ownerName)}</span>
                </p>
              </div>
              <div className="col-span-2 flex flex-wrap gap-2 sm:col-span-1 sm:justify-end">
                <Link
                  to="/play/$mapId"
                  params={{ mapId: String(map.id) }}
                  variant="primary"
                  size="sm"
                  aria-label={`${hu.maps.play}: ${map.title}`}
                >
                  {hu.maps.play}
                </Link>
                <Link
                  to="/leaderboard/$mapId"
                  params={{ mapId: String(map.id) }}
                  variant="secondary"
                  size="sm"
                  aria-label={`${hu.maps.leaderboard}: ${map.title}`}
                >
                  {hu.maps.leaderboard}
                </Link>
                {map.ownerId === user.id || user.role === "admin" ? (
                  <Link
                    to="/maps/$mapId/edit"
                    params={{ mapId: String(map.id) }}
                    variant="ghost"
                    size="sm"
                    aria-label={`${hu.maps.edit}: ${map.title}`}
                  >
                    {hu.maps.edit}
                  </Link>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}

export const Route = createFileRoute("/_app/maps/")({
  validateSearch: searchSchema,
  component: MapsPage,
});
