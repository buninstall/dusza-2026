import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "../components/ui/Button.tsx";
import { ModalShell } from "../components/ui/Dialog.tsx";
import { hu } from "../i18n/hu.ts";
import { mapsQuery } from "../maps/queries.ts";
import { sortMaps } from "../maps/sort.ts";
import { useTour } from "./tour-state.ts";
import "./Tour.css";

export function useStartTour() {
  const navigate = useNavigate();
  const start = useTour((state) => state.start);
  const { data } = useQuery(mapsQuery("all"));
  const first = data ? sortMaps(data.maps, "order")[0] : undefined;
  if (!first) {
    return null;
  }
  return () => {
    start(first.id);
    void navigate({ to: "/play/$mapId", params: { mapId: String(first.id) } });
  };
}

export function TourPrompt() {
  const status = useTour((state) => state.data.status);
  const decline = useTour((state) => state.decline);
  const startTour = useStartTour();
  if (status !== "unasked" || !startTour) {
    return null;
  }
  return (
    <ModalShell
      title={hu.tour.askTitle}
      isOpen
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          decline();
        }
      }}
    >
      {() => (
        <>
          <p className="overlay-body">{hu.tour.askBody}</p>
          <div className="overlay-actions">
            <Button onPress={decline}>{hu.tour.decline}</Button>
            <Button variant="primary" icon="play" onPress={startTour} autoFocus>
              {hu.tour.accept}
            </Button>
          </div>
        </>
      )}
    </ModalShell>
  );
}
