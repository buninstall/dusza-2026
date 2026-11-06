import { Pause, Play, RotateCcw, SkipBack, SkipForward, Square } from "lucide-react";
import { Slider as AriaSlider, Label, SliderThumb, SliderTrack } from "react-aria-components";
import { Button } from "../components/ui/Button.tsx";
import { Slider } from "../components/ui/Slider.tsx";
import { Tooltip } from "../components/ui/Tooltip.tsx";
import { hu } from "../i18n/hu.ts";
import { SPEED_MAX, SPEED_MIN, usePlayback } from "./playback-store.ts";

export function PlaybackControls() {
  const { result, index, status, speed } = usePlayback();
  const actions = usePlayback.getState();
  const total = result?.events.length ?? 0;
  const hasTrace = result !== null;
  const isPlaying = status === "playing";

  return (
    <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
      <div className="flex items-center gap-1">
        <Tooltip content={hu.play.restart}>
          <Button
            size="sm"
            variant="ghost"
            aria-label={hu.play.restart}
            isDisabled={!hasTrace}
            onPress={actions.reset}
          >
            <RotateCcw aria-hidden size={16} />
          </Button>
        </Tooltip>
        <Tooltip content={hu.play.stepBack}>
          <Button
            size="sm"
            variant="ghost"
            aria-label={hu.play.stepBack}
            isDisabled={!hasTrace || index === 0}
            onPress={actions.back}
          >
            <SkipBack aria-hidden size={16} />
          </Button>
        </Tooltip>
        <Tooltip content={isPlaying ? hu.play.pause : hu.play.resume}>
          <Button
            size="sm"
            aria-label={isPlaying ? hu.play.pause : hu.play.resume}
            isDisabled={!hasTrace || status === "stopped"}
            onPress={isPlaying ? actions.pause : actions.play}
          >
            {isPlaying ? <Pause aria-hidden size={16} /> : <Play aria-hidden size={16} />}
          </Button>
        </Tooltip>
        <Tooltip content={hu.play.stepForward}>
          <Button
            size="sm"
            variant="ghost"
            aria-label={hu.play.stepForward}
            isDisabled={!hasTrace || index >= total}
            onPress={actions.step}
          >
            <SkipForward aria-hidden size={16} />
          </Button>
        </Tooltip>
        <Tooltip content={hu.play.stop}>
          <Button
            size="sm"
            variant="ghost"
            aria-label={hu.play.stop}
            isDisabled={!hasTrace || status === "finished" || status === "stopped"}
            onPress={actions.stop}
          >
            <Square aria-hidden size={16} />
          </Button>
        </Tooltip>
      </div>
      <AriaSlider
        aria-label={hu.play.position}
        minValue={0}
        maxValue={Math.max(total, 1)}
        value={index}
        isDisabled={!hasTrace || status === "stopped"}
        onChange={(value) => actions.seek(value)}
        className="flex min-w-40 flex-1 flex-col gap-1"
      >
        <Label className="eyebrow">
          {hu.play.steps}: {index} / {total}
        </Label>
        <SliderTrack className="relative h-6 w-full">
          <div className="absolute top-1/2 h-1 w-full -translate-y-1/2 rounded-full bg-line" />
          <SliderThumb className="top-1/2 size-4 rounded-full border-2 border-ink bg-ore outline-none data-[focus-visible]:outline-3 data-[focus-visible]:outline-lamp" />
        </SliderTrack>
      </AriaSlider>
      <Slider
        label={hu.play.speed}
        minValue={SPEED_MIN}
        maxValue={SPEED_MAX}
        value={speed}
        onChange={(value) => actions.setSpeed(value)}
        format={hu.play.speedValue}
      />
    </div>
  );
}
