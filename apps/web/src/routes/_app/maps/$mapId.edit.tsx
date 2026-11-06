import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Notice } from "../../../components/Notice.tsx";
import { ConfirmDialog } from "../../../components/ui/Dialog.tsx";
import { toast } from "../../../components/ui/Toast.tsx";
import { useEngine } from "../../../engine/useEngine.ts";
import { hu } from "../../../i18n/hu.ts";
import { api, call, errorMessage } from "../../../lib/api.ts";
import { draftFromMap } from "../../../map/editor-state.ts";
import { MapEditor } from "../../../map/MapEditor.tsx";
import { mapQuery } from "../../../map/queries.ts";

function EditMapPage() {
  const { mapId } = Route.useParams();
  const id = Number(mapId);
  const engine = useEngine();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data, error } = useQuery(mapQuery(id));

  if (error) {
    return <Notice tone="error" title={errorMessage(error, hu.play.loadFailed)} />;
  }
  if (!data) {
    return <p className="pt-6 text-ink-muted">{hu.common.loading}</p>;
  }
  const parsed = engine.parseMap(data.version.content).map;
  if (!parsed) {
    return <Notice tone="error" title={hu.play.loadFailed} />;
  }

  const remove = async () => {
    try {
      await call(api.maps[":id"].$delete({ param: { id: mapId } }));
      await queryClient.invalidateQueries({ queryKey: ["maps"] });
      await navigate({ to: "/maps" });
    } catch (caught) {
      toast.error(errorMessage(caught, hu.app.unexpected));
    }
  };

  return (
    <div className="flex flex-col gap-6 pt-6">
      <h1 className="text-4xl font-black tracking-tighter">{hu.editor.editTitle}</h1>
      <MapEditor
        key={data.version.id}
        initialDraft={draftFromMap(parsed)}
        initialValues={{
          title: data.map.title,
          description: data.map.description,
          visibility: data.map.visibility,
        }}
        onSave={async (values) => {
          try {
            const result = await call(api.maps[":id"].$put({ param: { id: mapId }, json: values }));
            await queryClient.invalidateQueries({ queryKey: ["maps"] });
            await queryClient.invalidateQueries({ queryKey: ["map", id] });
            toast.success(result.createdNewVersion ? hu.editor.savedNewVersion : hu.editor.saved);
          } catch (caught) {
            toast.error(errorMessage(caught, hu.app.unexpected));
          }
        }}
        extraActions={
          data.canEdit ? (
            <ConfirmDialog
              triggerLabel={hu.editor.deleteMap}
              title={hu.editor.deleteMap}
              body={hu.editor.deleteConfirm}
              confirmLabel={hu.editor.confirmDelete}
              onConfirm={() => void remove()}
            />
          ) : null
        }
      />
    </div>
  );
}

export const Route = createFileRoute("/_app/maps/$mapId/edit")({
  component: EditMapPage,
});
