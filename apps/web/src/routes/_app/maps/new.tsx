import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "../../../components/ui/Toast.tsx";
import { hu } from "../../../i18n/hu.ts";
import { api, call, errorMessage } from "../../../lib/api.ts";
import { emptyDraft } from "../../../map/editor-state.ts";
import { MapEditor } from "../../../map/MapEditor.tsx";

function NewMapPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  return (
    <div className="flex flex-col gap-6 pt-6">
      <h1 className="text-4xl font-black tracking-tighter">{hu.editor.newTitle}</h1>
      <MapEditor
        initialDraft={emptyDraft()}
        initialValues={{ title: "", description: "", visibility: "public" }}
        onSave={async (values) => {
          try {
            const { map } = await call(api.maps.$post({ json: values }));
            await queryClient.invalidateQueries({ queryKey: ["maps"] });
            toast.success(hu.editor.saved);
            await navigate({ to: "/play/$mapId", params: { mapId: String(map.id) } });
          } catch (error) {
            toast.error(errorMessage(error, hu.app.unexpected));
          }
        }}
      />
    </div>
  );
}

export const Route = createFileRoute("/_app/maps/new")({
  component: NewMapPage,
});
