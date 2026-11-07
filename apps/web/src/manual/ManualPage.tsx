import { useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { LocationPlate } from "../components/LocationPlate.tsx";
import { Button } from "../components/ui/Button.tsx";
import { Link } from "../components/ui/Link.tsx";
import { hu } from "../i18n/hu.ts";
import { type ManualSection, manual } from "../i18n/hu-manual.ts";
import { PixelIcon } from "../pixel/PixelIcon.tsx";
import { PixelText } from "../pixel/PixelText.tsx";
import { PixelSprite } from "../pixel/SpriteLayers.tsx";
import { TILE_SPRITES } from "../pixel/tiles.ts";
import { useStartTour } from "../tour/TourPrompt.tsx";
import { Block } from "./ManualBlocks.tsx";
import "./ManualPage.css";

const ORE_GLINT = { "ore-hi": "px-glint" } as const;
const SECTIONS = manual.sections;
const TOTAL = SECTIONS.length;

function partOf(id: string): string {
  return manual.parts.find((part) => part.ids.includes(id))?.title ?? "";
}

function indexOf(hash: string): number {
  const found = SECTIONS.findIndex((section) => section.id === hash);
  return Math.max(found, 0);
}

function numberOf(index: number): string {
  return String(index + 1).padStart(2, "0");
}

function RecipesEntry() {
  const [wall, wallAlt] = TILE_SPRITES.wall;
  return (
    <Link
      to="/manual/receptek"
      variant="plain"
      className="manual-recipes"
      aria-label={hu.recipes.entryLabel}
    >
      <span aria-hidden="true" className="manual-seam">
        {wall ? <PixelSprite sprite={wall} className="manual-seam-tile" /> : null}
        <PixelSprite sprite={TILE_SPRITES.gold} className="manual-seam-tile" animated={ORE_GLINT} />
        {wallAlt ? <PixelSprite sprite={wallAlt} className="manual-seam-tile" /> : null}
      </span>
      <span className="manual-recipes-text">{hu.recipes.entry}</span>
    </Link>
  );
}

function TourRestart() {
  const startTour = useStartTour();
  if (!startTour) {
    return null;
  }
  return (
    <div className="manual-tour">
      <Button size="sm" icon="play" onPress={startTour}>
        {hu.tour.restart}
      </Button>
      <p className="manual-tour-hint">{hu.tour.restartHint}</p>
    </div>
  );
}

type ChapterLinkProps = {
  section: ManualSection;
  index: number;
  isCurrent: boolean;
  onPick: () => void;
};

function ChapterLink({ section, index, isCurrent, onPick }: ChapterLinkProps) {
  return (
    <Link
      to="/manual"
      hash={section.id}
      resetScroll={false}
      hashScrollIntoView={false}
      variant="plain"
      className="manual-toc-link"
      activeOptions={{ includeHash: true }}
      data-here={isCurrent || undefined}
      onPress={onPick}
    >
      <span aria-hidden="true" className="manual-toc-no">
        {numberOf(index)}
      </span>
      <span className="manual-toc-title">{section.title}</span>
    </Link>
  );
}

function Contents({ current }: { current: number }) {
  const [isOpen, setOpen] = useState(false);
  const active = SECTIONS[current];
  const close = () => setOpen(false);
  return (
    <nav aria-label={manual.tocLabel} className="manual-toc" data-open={isOpen || undefined}>
      <Button
        size="sm"
        icon="list"
        className="manual-toc-toggle"
        aria-expanded={isOpen}
        aria-controls="manual-toc-parts"
        onPress={() => setOpen((open) => !open)}
      >
        {manual.tocToggle}
        <span className="manual-toc-toggle-current">
          {numberOf(current)} · {active?.title}
        </span>
        <PixelIcon name="chevronDown" />
      </Button>
      <div id="manual-toc-parts" className="manual-toc-parts">
        {manual.parts.map((part) => (
          <div key={part.title} className="manual-toc-part">
            <p className="manual-toc-part-title" id={`manual-part-${part.ids[0] ?? ""}`}>
              {part.title}
            </p>
            <ul className="manual-toc-list" aria-labelledby={`manual-part-${part.ids[0] ?? ""}`}>
              {part.ids.map((id) => {
                const index = SECTIONS.findIndex((section) => section.id === id);
                const section = SECTIONS[index];
                if (!section) {
                  return null;
                }
                return (
                  <li key={id}>
                    <ChapterLink
                      section={section}
                      index={index}
                      isCurrent={index === current}
                      onPick={close}
                    />
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
        <div className="manual-toc-extra">
          <RecipesEntry />
          <TourRestart />
        </div>
      </div>
    </nav>
  );
}

function Progress({ current }: { current: number }) {
  return (
    <span aria-hidden="true" className="manual-progress">
      {SECTIONS.map((section, index) => (
        <span
          key={section.id}
          className="manual-progress-cell"
          data-state={index < current ? "done" : index === current ? "current" : undefined}
        />
      ))}
    </span>
  );
}

type PagerLinkProps = { index: number; direction: "previous" | "next" };

function PagerLink({ index, direction }: PagerLinkProps) {
  const section = SECTIONS[index];
  if (!section) {
    return <span className="manual-pager-gap" />;
  }
  const label = direction === "previous" ? manual.previous : manual.next;
  return (
    <Link
      to="/manual"
      hash={section.id}
      resetScroll={false}
      hashScrollIntoView={false}
      variant="plain"
      className="manual-pager-link"
      data-direction={direction}
      activeOptions={{ includeHash: true }}
    >
      <span className="manual-pager-kind">
        <PixelIcon name={direction === "previous" ? "arrowLeft" : "arrowRight"} />
        {label}
      </span>
      <span className="manual-pager-title">
        <span aria-hidden="true" className="manual-pager-no">
          {numberOf(index)}
        </span>
        {section.title}
      </span>
    </Link>
  );
}

function Chapter({ section, index }: { section: ManualSection; index: number }) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const shownRef = useRef(section.id);
  useEffect(() => {
    if (shownRef.current === section.id) {
      return;
    }
    shownRef.current = section.id;
    const heading = headingRef.current;
    if (!heading) {
      return;
    }
    heading.focus({ preventScroll: true });
    const top = heading.closest(".manual-article")?.getBoundingClientRect().top ?? 0;
    if (top < 0) {
      heading.closest(".manual-article")?.scrollIntoView({ block: "start" });
    }
  }, [section.id]);
  const [first, ...rest] = section.blocks;
  const hasLede = first?.kind === "paragraph";
  return (
    <article id={section.id} aria-labelledby={`${section.id}-title`} className="manual-article">
      <header className="manual-head">
        <p className="manual-kicker">
          <span className="manual-kicker-part">{partOf(section.id)}</span>
          <span className="manual-kicker-count">{manual.chapterOf(index + 1, TOTAL)}</span>
          <Progress current={index} />
        </p>
        <h2 id={`${section.id}-title`} ref={headingRef} tabIndex={-1} className="manual-title">
          <span aria-hidden="true" className="manual-title-no">
            <PixelText text={numberOf(index)} scale={3} />
          </span>
          <span className="manual-title-text">{section.title}</span>
        </h2>
      </header>
      <div className="manual-body">
        {first ? <Block block={first} isLede={hasLede} /> : null}
        {rest.map((block, position) => (
          <Block key={`${section.id}-${(position + 1).toString()}`} block={block} />
        ))}
      </div>
      <nav aria-label={manual.pagerLabel} className="manual-pager">
        <PagerLink index={index - 1} direction="previous" />
        <PagerLink index={index + 1} direction="next" />
      </nav>
    </article>
  );
}

export function ManualPage() {
  const hash = useLocation({ select: (location) => location.hash });
  const isHere = useLocation({
    select: (location) => location.pathname.replace(/\/$/, "") === "/manual",
  });
  const navigate = useNavigate();
  const current = indexOf(hash);
  const section = SECTIONS[current];
  useEffect(() => {
    if (isHere && section && section.id !== hash) {
      void navigate({
        to: "/manual",
        hash: section.id,
        replace: true,
        resetScroll: false,
        hashScrollIntoView: false,
      });
    }
  }, [hash, section, navigate, isHere]);
  return (
    <div className="manual-page">
      <LocationPlate name={hu.signs.manual} />
      <div className="manual-layout">
        <Contents current={current} />
        {section ? <Chapter section={section} index={current} /> : null}
      </div>
    </div>
  );
}
