import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Loading } from "../app/StatusScreens.tsx";
import { LoadFailed } from "../components/LoadFailed.tsx";
import { Notice } from "../components/Notice.tsx";
import { toast } from "../components/ui/Toast.tsx";
import { useEngine } from "../engine/useEngine.ts";
import { hu } from "../i18n/hu.ts";
import { api, call, errorMessage } from "../lib/api.ts";
import { type MapDetail, mapQuery } from "../maps/queries.ts";
import { draftFromMap, emptyDraft } from "./editor-state.ts";
import { MapEditor, type MapFormValues } from "./MapEditor.tsx";

export function NewMapPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [initialDraft] = useState(() => emptyDraft());

  const create = async (values: MapFormValues) => {
    try {
      const { map } = await call(api.maps.$post({ json: values }));
      await queryClient.invalidateQueries({ queryKey: ["maps"] });
      toast.success(hu.mapEditor.saved);
      await navigate({
        to: "/maps/$mapId/edit",
        params: { mapId: String(map.id) },
        replace: true,
      });
      return true;
    } catch (error) {
      toast.error(errorMessage(error, hu.app.unexpected));
      return false;
    }
  };

  return (
    <MapEditor
      mapId={null}
      initialDraft={initialDraft}
      initialDetails={{ title: "", description: "", visibility: "public", parSteps: null }}
      version={null}
      onSave={create}
    />
  );
}

function nextVersion(detail: MapDetail): number {
  return Math.max(...detail.versions.map((item) => item.version), detail.version.version) + 1;
}

function EditMapForm({ mapId, detail }: { mapId: number; detail: MapDetail }) {
  const engine = useEngine();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [initial] = useState(() => engine.parseMap(detail.version.content).map);
  const id = String(mapId);

  if (!detail.canEdit) {
    return <Notice tone="error" title={hu.mapEditor.forbidden} live="alert" />;
  }
  if (!initial) {
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
      return true;
    } catch (error) {
      toast.error(errorMessage(error, hu.app.unexpected));
      return false;
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
      mapId={mapId}
      initialDraft={draftFromMap(initial)}
      initialDetails={{
        title: detail.map.title,
        description: detail.map.description,
        visibility: detail.map.visibility,
        parSteps: detail.map.parSteps,
      }}
      version={{
        current: detail.version.version,
        next: nextVersion(detail),
        runCount: detail.runCount,
      }}
      onSave={update}
      onDelete={() => void remove()}
    />
  );
}

export function EditMapPage({ mapId }: { mapId: number }) {
  const { data, error, refetch } = useQuery(mapQuery(mapId));
  if (error) {
    return (
      <LoadFailed error={error} fallback={hu.play.loadFailed} onRetry={() => void refetch()} />
    );
  }
  return data ? <EditMapForm mapId={mapId} detail={data} /> : <Loading />;
}
