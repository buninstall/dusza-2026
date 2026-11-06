import { Button, Disclosure, DisclosurePanel, Heading } from "react-aria-components";
import { LocationPlate } from "../components/LocationPlate.tsx";
import { Link } from "../components/ui/Link.tsx";
import { hu } from "../i18n/hu.ts";
import { useMediaQuery } from "../lib/useMediaQuery.ts";
import { PixelIcon } from "../pixel/PixelIcon.tsx";
import { PixelSprite } from "../pixel/SpriteLayers.tsx";
import { TILE_SPRITES } from "../pixel/tiles.ts";
import { Section } from "./ManualBlocks.tsx";
import "./ManualPage.css";
import { useScrollSpy } from "./useScrollSpy.ts";

const SECTION_IDS = hu.manual.sections.map((section) => section.id);
const ORE_GLINT = { "ore-hi": "px-glint" } as const;

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

function TocList({ active }: { active: string | null }) {
  return (
    <>
      <ol className="manual-toc-list">
        {hu.manual.sections.map((section, index) => (
          <li key={section.id}>
            <a
              href={`#${section.id}`}
              className="manual-toc-link"
              aria-current={active === section.id ? "location" : undefined}
            >
              <span aria-hidden="true" className="manual-toc-no">
                {String(index + 1).padStart(2, "0")}
              </span>
              {section.title}
            </a>
          </li>
        ))}
      </ol>
      <RecipesEntry />
    </>
  );
}

function Toc() {
  const isWide = useMediaQuery("(min-width: 64rem)", true);
  const active = useScrollSpy(SECTION_IDS);
  if (isWide) {
    return (
      <nav aria-label={hu.manual.tocLabel} className="manual-toc">
        <p aria-hidden="true" className="label manual-toc-title">
          {hu.manual.tocLabel}
        </p>
        <TocList active={active} />
      </nav>
    );
  }
  return (
    <Disclosure className="manual-toc manual-disclosure">
      <Heading level={2} className="manual-disclosure-heading">
        <Button slot="trigger" className="manual-disclosure-trigger">
          <PixelIcon name="chevronDown" />
          {hu.manual.tocLabel}
        </Button>
      </Heading>
      <DisclosurePanel>
        <nav aria-label={hu.manual.tocLabel}>
          <TocList active={active} />
        </nav>
      </DisclosurePanel>
    </Disclosure>
  );
}

export function ManualPage() {
  return (
    <div className="manual-page">
      <LocationPlate name={hu.signs.manual} />
      <div className="manual-layout">
        <Toc />
        <article className="manual-article">
          {hu.manual.sections.map((section, index) => (
            <Section key={section.id} section={section} index={index} />
          ))}
        </article>
      </div>
    </div>
  );
}
