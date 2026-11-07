import { type StratumId, story } from "../i18n/hu-story.ts";
import { PixelIcon } from "../pixel/PixelIcon.tsx";
import { PixelText } from "../pixel/PixelText.tsx";
import { STRATUM_INDEX } from "./campaign.ts";
import "./ChapterPlate.css";

type ChapterCounterProps = { remaining: number; stratum: StratumId };

export function ChapterCounter({ remaining, stratum }: ChapterCounterProps) {
  return (
    <p
      className="ch-counter"
      data-mine="counter"
      data-stratum={STRATUM_INDEX[stratum]}
      data-rock={stratum}
    >
      <PixelIcon name="lock" />
      <PixelText text={story.counter(remaining)} scale={3} />
      <span className="visually-hidden">{story.counterLabel(remaining)}</span>
    </p>
  );
}
