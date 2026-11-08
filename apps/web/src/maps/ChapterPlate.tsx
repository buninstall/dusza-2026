import { type Chapter, chapterName, story } from "../i18n/hu-story.ts";
import { PixelIcon } from "../pixel/PixelIcon.tsx";
import { PixelText } from "../pixel/PixelText.tsx";
import { type ChapterGroup, STRATUM_INDEX } from "./campaign.ts";
import "./ChapterPlate.css";

type ChapterCounterProps = { chapter: Chapter; lock: ChapterGroup["lock"] };

export function ChapterCounter({ chapter, lock }: ChapterCounterProps) {
  const isOpen = lock === null;
  return (
    <p
      className="ch-counter"
      data-mine="counter"
      data-stratum={STRATUM_INDEX[chapter.stratum]}
      data-rock={chapter.stratum}
      data-state={isOpen ? "open" : "locked"}
    >
      <PixelIcon name={isOpen ? "check" : "lock"} />
      <PixelText text={isOpen ? story.counterOpen : story.counter(lock.remaining)} scale={3} />
      <span className="visually-hidden">
        {isOpen
          ? story.counterOpenLabel(chapterName(chapter))
          : story.counterLabel(lock.remaining, chapterName(chapter))}
      </span>
    </p>
  );
}
