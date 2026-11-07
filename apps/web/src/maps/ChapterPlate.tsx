import { story } from "../i18n/hu-story.ts";
import { PixelIcon } from "../pixel/PixelIcon.tsx";
import { type ChapterGroup, STRATUM_INDEX } from "./campaign.ts";
import "./ChapterPlate.css";

type ChapterPlateProps = { group: ChapterGroup; headingId: string };

function Diary({ group }: { group: ChapterGroup }) {
  const { chapter } = group;
  if (!group.hasDiary) {
    return (
      <p className="ch-diary" data-state="locked">
        <PixelIcon name="lock" />
        <span>{story.diaryLocked}</span>
      </p>
    );
  }
  return (
    <figure className="ch-diary" data-state="open">
      <blockquote className="ch-diary-text">
        <p>{chapter.diary}</p>
      </blockquote>
      <figcaption className="ch-diary-by">{story.diaryBy(chapter.diaryDate)}</figcaption>
    </figure>
  );
}

function Finding({ group }: { group: ChapterGroup }) {
  const { finding, levels } = group.chapter;
  if (!group.hasFinding) {
    return (
      <p className="ch-finding" data-state="locked">
        <PixelIcon name="lock" />
        <span>{story.findingLocked(group.cleared, levels.length)}</span>
      </p>
    );
  }
  return (
    <div className="ch-finding" data-state="open">
      <p className="ch-finding-head">
        <PixelIcon name="robot" />
        <span>{story.findingHeading(finding.robot)}</span>
      </p>
      <p className="ch-finding-fate">{finding.fate}</p>
      <p className="ch-finding-lesson">
        <strong>{story.findingLesson}:</strong> {finding.lesson}
      </p>
      <p className="ch-finding-code mono">{story.findingCode(finding.code)}</p>
    </div>
  );
}

export function ChapterPlate({ group, headingId }: ChapterPlateProps) {
  const { chapter } = group;
  return (
    <header
      className="ch-plate"
      data-mine="chapter"
      data-stratum={STRATUM_INDEX[chapter.stratum]}
      data-rock={chapter.stratum}
    >
      <p className="ch-depth">{story.depthRock(chapter.depth, chapter.rock)}</p>
      <h2 id={headingId} className="ch-title">
        {story.chapterHeading(chapter.numeral, chapter.title)}
      </h2>
      <p className="ch-intro">{chapter.intro}</p>
      <Diary group={group} />
      <Finding group={group} />
      <p className="ch-progress" data-complete={group.cleared === chapter.levels.length}>
        <PixelIcon name={group.cleared === chapter.levels.length ? "check" : "pickaxe"} />
        <span>{story.progressLabel(group.cleared, chapter.levels.length)}</span>
      </p>
    </header>
  );
}

type EpiloguePlateProps = { isSilent: boolean; stratum: number };

export function EpiloguePlate({ isSilent, stratum }: EpiloguePlateProps) {
  return (
    <section
      className="ch-plate ch-epilogue"
      data-mine="chapter"
      data-stratum={stratum}
      data-state={isSilent ? "open" : "locked"}
      aria-labelledby="ch-epilogue-title"
    >
      <h2 id="ch-epilogue-title" className="ch-title">
        {story.epilogueHeading}
      </h2>
      {isSilent ? (
        <p className="ch-intro">{story.epilogue}</p>
      ) : (
        <p className="ch-diary" data-state="locked">
          <PixelIcon name="lock" />
          <span>{story.epilogueLocked}</span>
        </p>
      )}
    </section>
  );
}

type OthersPlateProps = { headingId: string; stratum: number };

export function OthersPlate({ headingId, stratum }: OthersPlateProps) {
  return (
    <header className="ch-plate" data-mine="chapter" data-stratum={stratum} data-rock="core">
      <h2 id={headingId} className="ch-title">
        {story.othersHeading}
      </h2>
      <p className="ch-intro">{story.othersText}</p>
    </header>
  );
}
