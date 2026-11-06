import { useQuery } from "@tanstack/react-query";
import { Loading } from "../app/StatusScreens.tsx";
import type { SessionUser } from "../auth/session.ts";
import { Notice } from "../components/Notice.tsx";
import { PageHeader } from "../components/PageHeader.tsx";
import { Link } from "../components/ui/Link.tsx";
import { Tab, TabList, TabPanel, Tabs } from "../components/ui/Tabs.tsx";
import { hu } from "../i18n/hu.ts";
import { errorMessage } from "../lib/api.ts";
import "./MapsPage.css";
import { type MapScope, mapsQuery } from "./queries.ts";
import { ShaftLevel } from "./ShaftLevel.tsx";

type MapsPageProps = {
  scope: MapScope;
  user: SessionUser;
  onScopeChange: (scope: MapScope) => void;
};

function ShaftList({ scope, user }: { scope: MapScope; user: SessionUser }) {
  const { data, error, isPending } = useQuery(mapsQuery(scope));
  if (error) {
    return <Notice tone="error" title={errorMessage(error, hu.maps.loadFailed)} live="alert" />;
  }
  if (isPending) {
    return <Loading />;
  }
  if (data.maps.length === 0) {
    return <Notice tone="info" title={scope === "mine" ? hu.maps.emptyMine : hu.maps.empty} />;
  }
  return (
    <ol className="maps-shaft" aria-label={hu.maps.listLabel}>
      {data.maps.map((map, index) => (
        <ShaftLevel
          key={map.id}
          map={map}
          depth={index + 1}
          canEdit={map.ownerId === user.id || user.role === "admin"}
        />
      ))}
    </ol>
  );
}

export function MapsPage({ scope, user, onScopeChange }: MapsPageProps) {
  return (
    <div className="maps-page">
      <PageHeader
        eyebrow={hu.maps.eyebrow}
        title={hu.maps.title}
        lead={hu.maps.lead}
        actions={
          <Link to="/maps/new" variant="primary" icon="pickaxe">
            {hu.nav.newMap}
          </Link>
        }
      />
      <Tabs
        selectedKey={scope}
        onSelectionChange={(key) => onScopeChange(key === "mine" ? "mine" : "all")}
      >
        <TabList aria-label={hu.maps.scopeLabel}>
          <Tab id="all">{hu.maps.scopeAll}</Tab>
          <Tab id="mine">{hu.maps.scopeMine}</Tab>
        </TabList>
        <TabPanel id="all">
          {scope === "all" ? <ShaftList scope="all" user={user} /> : null}
        </TabPanel>
        <TabPanel id="mine">
          {scope === "mine" ? <ShaftList scope="mine" user={user} /> : null}
        </TabPanel>
      </Tabs>
    </div>
  );
}
