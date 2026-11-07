import { story } from "../i18n/hu-story.ts";
import { PixelIcon } from "../pixel/PixelIcon.tsx";
import { type ChapterGroup, STRATUM_INDEX } from "./campaign.ts";
import "./ChapterPlate.css";

function Journal({ group }: { group: ChapterGroup }) {
  const { chapter } = group;
  return (
    <details className="ch-journal">
      <summary className="ch-journal-toggle">
        <PixelIcon name="book" />
        <span>{story.journal}</span>
      </summary>
      <div className="ch-journal-body">
        <p>{chapter.intro}</p>
        {group.hasDiary ? (
          <figure className="ch-diary">
            <blockquote className="ch-diary-text">
              <p>{chapter.diary}</p>
            </blockquote>
            <figcaption className="ch-diary-by">{story.diaryBy(chapter.diaryDate)}</figcaption>
          </figure>
        ) : (
          <p className="ch-muted">{story.diaryLocked}</p>
        )}
        {group.isComplete ? (
          <div className="ch-finding">
            <p className="ch-finding-head">
              <PixelIcon name="robot" />
              <span>{story.findingHeading(chapter.finding.robot)}</span>
            </p>
            <p>{chapter.finding.fate}</p>
            <p>
              <strong>{story.findingLesson}:</strong> {chapter.finding.lesson}
            </p>
            <p className="ch-finding-code mono">{story.findingCode(chapter.finding.code)}</p>
          </div>
        ) : (
          <p className="ch-muted">{story.findingLocked}</p>
        )}
      </div>
    </details>
  );
}

function LockNote({ lock }: { lock: NonNullable<ChapterGroup["lock"]> }) {
  if (lock.isChained) {
    return <p className="ch-locked-from">{story.lockedChained}</p>;
  }
  return (
    <>
      <p className="ch-locked-count">{story.lockedCount(lock.remaining)}</p>
      <p className="ch-locked-from">{story.lockedFrom(lock.previous.from)}</p>
    </>
  );
}

export function ChapterSign({ group, headingId }: { group: ChapterGroup; headingId: string }) {
  const { chapter, lock } = group;
  const total = chapter.levels.length;
  return (
    <header
      className="ch-sign"
      data-mine="chapter"
      data-stratum={STRATUM_INDEX[chapter.stratum]}
      data-rock={chapter.stratum}
      data-state={lock ? "locked" : "open"}
    >
      <div className={lock ? "ch-sign-plate ch-sign-locked" : "ch-sign-plate"}>
        {lock ? <PixelIcon name="lock" size="lg" /> : null}
        <div className="ch-sign-text">
          <p className="ch-depth">{story.depthRock(chapter.depth, chapter.rock)}</p>
          <h2 id={headingId} className="ch-title">
            {story.chapterHeading(chapter.numeral, chapter.title)}
          </h2>
          {lock ? (
            <LockNote lock={lock} />
          ) : (
            <p className="ch-progress" data-complete={group.isComplete}>
              <PixelIcon name={group.isComplete ? "check" : "pickaxe"} />
              <span>{story.progress(group.cleared, total)}</span>
            </p>
          )}
        </div>
      </div>
      {lock ? null : <Journal group={group} />}
    </header>
  );
}

export function EpilogueSign({ stratum }: { stratum: number }) {
  return (
    <section
      className="ch-sign"
      data-mine="chapter"
      data-stratum={stratum}
      data-rock="obsidian"
      aria-labelledby="ch-epilogue-title"
    >
      <div className="ch-sign-plate">
        <h2 id="ch-epilogue-title" className="ch-title">
          {story.epilogueHeading}
        </h2>
        <p className="ch-epilogue">{story.epilogue}</p>
      </div>
    </section>
  );
}
