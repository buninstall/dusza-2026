import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "../components/ui/Button.tsx";
import { ModalShell } from "../components/ui/Dialog.tsx";
import { hu } from "../i18n/hu.ts";
import { tourModes } from "../i18n/hu-story.ts";
import type { PlayMode } from "../maps/mode.ts";
import { firstSandboxMapQuery, storyMapsQuery } from "../maps/queries.ts";
import { PixelIcon } from "../pixel/PixelIcon.tsx";
import { useTour } from "./tour-state.ts";
import "./Tour.css";

export function useStartTour(mode: PlayMode = "story") {
  const navigate = useNavigate();
  const start = useTour((state) => state.start);
  const storyList = useQuery({ ...storyMapsQuery(), enabled: mode === "story" });
  const sandboxList = useQuery({ ...firstSandboxMapQuery(), enabled: mode === "sandbox" });
  const first = mode === "story" ? storyList.data?.maps[0] : sandboxList.data?.maps[0];
  if (!first) {
    return null;
  }
  return () => {
    start(first.id, mode);
    void navigate({ to: "/play/$mapId", params: { mapId: String(first.id) } });
  };
}

function ModeChoice({ onBack }: { onBack: () => void }) {
  const startSandbox = useStartTour("sandbox");
  const startStory = useStartTour("story");
  return (
    <>
      <div className="tour-modes">
        <section className="tour-mode" aria-labelledby="tour-mode-sandbox">
          <h3 id="tour-mode-sandbox" className="tour-mode-title">
            <PixelIcon name="pickaxe" />
            {tourModes.sandboxTitle}
          </h3>
          <p>{tourModes.sandbox}</p>
        </section>
        <section className="tour-mode" aria-labelledby="tour-mode-story">
          <h3 id="tour-mode-story" className="tour-mode-title">
            <PixelIcon name="book" />
            {tourModes.storyTitle}
          </h3>
          <p>{tourModes.story}</p>
        </section>
      </div>
      <p className="overlay-body tour-question">{tourModes.question}</p>
      <div className="overlay-actions">
        <Button variant="ghost" onPress={onBack}>
          {tourModes.back}
        </Button>
        <Button icon="book" onPress={() => startStory?.()} isDisabled={!startStory}>
          {tourModes.pickStory}
        </Button>
        <Button
          variant="primary"
          icon="pickaxe"
          onPress={() => startSandbox?.()}
          isDisabled={!startSandbox}
          autoFocus
        >
          {tourModes.pickSandbox}
        </Button>
      </div>
    </>
  );
}

export function TourPrompt() {
  const status = useTour((state) => state.data.status);
  const decline = useTour((state) => state.decline);
  const [stage, setStage] = useState<"ask" | "modes">("ask");
  const { data } = useQuery(storyMapsQuery());
  if (status !== "unasked" || !data || data.maps.length === 0) {
    return null;
  }
  return (
    <ModalShell
      title={stage === "ask" ? hu.tour.askTitle : tourModes.title}
      isOpen
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          decline();
        }
      }}
    >
      {() =>
        stage === "ask" ? (
          <>
            <p className="overlay-body">{hu.tour.askBody}</p>
            <div className="overlay-actions">
              <Button onPress={decline}>{hu.tour.decline}</Button>
              <Button variant="primary" icon="play" onPress={() => setStage("modes")} autoFocus>
                {hu.tour.accept}
              </Button>
            </div>
          </>
        ) : (
          <ModeChoice onBack={() => setStage("ask")} />
        )
      }
    </ModalShell>
  );
}
