import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Loading } from "../app/StatusScreens.tsx";
import { LocationPlate } from "../components/LocationPlate.tsx";
import { Notice } from "../components/Notice.tsx";
import { ConfirmDialog } from "../components/ui/Dialog.tsx";
import { Link } from "../components/ui/Link.tsx";
import { toast } from "../components/ui/Toast.tsx";
import { useEngine } from "../engine/useEngine.ts";
import { hu } from "../i18n/hu.ts";
import { api, call, errorMessage } from "../lib/api.ts";
import { type MapDetail, mapQuery } from "../maps/queries.ts";
import { draftFromMap, emptyDraft } from "./editor-state.ts";
import { MapEditor, type MapFormValues } from "./MapEditor.tsx";
import "./MapEditor.css";

export function NewMapPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const create = async (values: MapFormValues) => {
    try {
      const { map } = await call(api.maps.$post({ json: values }));
      await queryClient.invalidateQueries({ queryKey: ["maps"] });
      toast.success(hu.mapEditor.saved);
      await navigate({ to: "/play/$mapId", params: { mapId: String(map.id) } });
    } catch (error) {
      toast.error(errorMessage(error, hu.app.unexpected));
    }
  };

  return (
    <div className="editor-page">
      <LocationPlate name={hu.signs.editor} detail={hu.mapEditor.newTitle} />
      <MapEditor
        initialDraft={emptyDraft()}
        initialDetails={{ title: "", description: "", visibility: "public" }}
        onSave={create}
      />
    </div>
  );
}

function nextVersion(detail: MapDetail): number {
  return Math.max(...detail.versions.map((item) => item.version), detail.version.version) + 1;
}

function EditMapForm({ mapId, detail }: { mapId: number; detail: MapDetail }) {
  const engine = useEngine();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const parsed = engine.parseMap(detail.version.content).map;
  const id = String(mapId);

  if (!detail.canEdit) {
    return <Notice tone="error" title={hu.mapEditor.forbidden} live="alert" />;
  }
  if (!parsed) {
    return <Notice tone="error" title={hu.play.loadFailed} live="alert" />;
  }

  const update = async (values: MapFormValues) => {
    try {
      const result = await call(api.maps[":id"].$put({ param: { id }, json: values }));
      await queryClient.invalidateQueries({ queryKey: ["maps"] });
      await queryClient.invalidateQueries({ queryKey: ["map", mapId] });
      await queryClient.invalidateQueries({ queryKey: ["leaderboard", mapId] });
      toast.success(
        result.createdNewVersion
          ? hu.mapEditor.savedNewVersion(nextVersion(detail))
          : hu.mapEditor.saved,
      );
    } catch (error) {
      toast.error(errorMessage(error, hu.app.unexpected));
    }
  };

  const remove = async () => {
    try {
      await call(api.maps[":id"].$delete({ param: { id } }));
      queryClient.removeQueries({ queryKey: ["map", mapId] });
      await queryClient.invalidateQueries({ queryKey: ["maps"] });
      toast.success(hu.mapEditor.deleted);
      await navigate({ to: "/maps" });
    } catch (error) {
      toast.error(errorMessage(error, hu.app.unexpected));
    }
  };

  return (
    <MapEditor
      key={detail.version.id}
      initialDraft={draftFromMap(parsed)}
      initialDetails={{
        title: detail.map.title,
        description: detail.map.description,
        visibility: detail.map.visibility,
      }}
      version={{
        current: detail.version.version,
        next: nextVersion(detail),
        runCount: detail.runCount,
      }}
      onSave={update}
      dangerZone={
        <div className="editor-danger">
          <ConfirmDialog
            triggerLabel={hu.mapEditor.deleteMap}
            triggerIcon="trash"
            title={hu.mapEditor.deleteTitle}
            body={hu.mapEditor.deleteConfirm(detail.map.title)}
            confirmLabel={hu.mapEditor.confirmDelete}
            onConfirm={() => void remove()}
          />
        </div>
      }
    />
  );
}

export function EditMapPage({ mapId }: { mapId: number }) {
  const { data, error } = useQuery(mapQuery(mapId));
  return (
    <div className="editor-page">
      <LocationPlate
        name={hu.signs.editor}
        detail={hu.mapEditor.editTitle}
        actions={
          data ? (
            <Link
              to="/play/$mapId"
              params={{ mapId: String(mapId) }}
              variant="secondary"
              icon="play"
            >
              {hu.maps.play}
            </Link>
          ) : null
        }
      />
      {error ? (
        <Notice tone="error" title={errorMessage(error, hu.play.loadFailed)} live="alert" />
      ) : null}
      {data ? <EditMapForm mapId={mapId} detail={data} /> : null}
      {!data && !error ? <Loading /> : null}
    </div>
  );
}
