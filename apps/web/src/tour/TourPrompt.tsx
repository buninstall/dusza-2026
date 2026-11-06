import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "../components/ui/Button.tsx";
import { hu } from "../i18n/hu.ts";
import { mapsQuery } from "../maps/queries.ts";
import { sortMaps } from "../maps/sort.ts";
import { PixelIcon } from "../pixel/PixelIcon.tsx";
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
    <section className="tour-prompt" aria-labelledby="tour-prompt-title">
      <span className="tour-prompt-icon" aria-hidden="true">
        <PixelIcon name="book" size="lg" />
      </span>
      <div className="tour-prompt-text">
        <h2 id="tour-prompt-title" className="tour-prompt-title">
          {hu.tour.askTitle}
        </h2>
        <p>{hu.tour.askBody}</p>
      </div>
      <div className="tour-prompt-actions">
        <Button variant="primary" icon="play" onPress={startTour}>
          {hu.tour.accept}
        </Button>
        <Button variant="ghost" onPress={decline}>
          {hu.tour.decline}
        </Button>
      </div>
    </section>
  );
}
