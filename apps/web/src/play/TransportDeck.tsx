import { Button } from "../components/ui/Button.tsx";
import { Slider } from "../components/ui/Slider.tsx";
import { hu } from "../i18n/hu.ts";
import { isPlaybackActive, SPEED_MAX, SPEED_MIN, usePlayback } from "./playback-store.ts";
import "./PlayPage.css";

export function TransportDeck() {
  const result = usePlayback((state) => state.result);
  const index = usePlayback((state) => state.index);
  const status = usePlayback((state) => state.status);
  const speed = usePlayback((state) => state.speed);
  const actions = usePlayback.getState();
  const total = result?.events.length ?? 0;
  const isActive = isPlaybackActive(status);
  const isPlaying = status === "playing";

  return (
    <section aria-labelledby="deck-title" className="play-deck">
      <h2 id="deck-title" className="visually-hidden">
        {hu.play.transport}
      </h2>
      <div className="play-deck-keys">
        <Button
          size="sm"
          icon="rewind"
          isDisabled={!isActive || index === 0}
          onPress={actions.restart}
        >
          {hu.play.restart}
        </Button>
        <Button
          size="sm"
          icon="stepBack"
          isDisabled={!isActive || index === 0}
          onPress={actions.back}
        >
          {hu.play.stepBack}
        </Button>
        <Button
          size="sm"
          variant={isPlaying ? "secondary" : "primary"}
          icon={isPlaying ? "pause" : "play"}
          isDisabled={!isActive}
          onPress={isPlaying ? actions.pause : actions.play}
        >
          {isPlaying ? hu.play.pause : hu.play.resume}
        </Button>
        <Button
          size="sm"
          icon="stepForward"
          isDisabled={!isActive || index >= total}
          onPress={actions.step}
        >
          {hu.play.stepForward}
        </Button>
        <Button size="sm" icon="skipEnd" isDisabled={!isActive} onPress={() => actions.seek(total)}>
          {hu.play.skipToEnd}
        </Button>
        <Button
          size="sm"
          variant="danger"
          icon="stop"
          isDisabled={!isActive}
          onPress={actions.stop}
        >
          {hu.play.stop}
        </Button>
      </div>
      <div className="play-deck-sliders">
        <Slider
          label={hu.play.timeline}
          minValue={0}
          maxValue={Math.max(total, 1)}
          value={index}
          isDisabled={!isActive}
          onChange={actions.seek}
          format={(value) => hu.play.timelineValue(value, total)}
        />
        <Slider
          label={hu.play.speed}
          minValue={SPEED_MIN}
          maxValue={SPEED_MAX}
          value={speed}
          onChange={actions.setSpeed}
          format={hu.play.speedValue}
        />
      </div>
    </section>
  );
}
