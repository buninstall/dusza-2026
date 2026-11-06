import { useLocation, useNavigate } from "@tanstack/react-router";
import { Tab, TabList, TabPanel, Tabs } from "react-aria-components";
import { LocationPlate } from "../components/LocationPlate.tsx";
import { Button } from "../components/ui/Button.tsx";
import { Link } from "../components/ui/Link.tsx";
import { hu } from "../i18n/hu.ts";
import { PixelSprite } from "../pixel/SpriteLayers.tsx";
import { TILE_SPRITES } from "../pixel/tiles.ts";
import { useStartTour } from "../tour/TourPrompt.tsx";
import { Section } from "./ManualBlocks.tsx";
import "./ManualPage.css";

const ORE_GLINT = { "ore-hi": "px-glint" } as const;
const FIRST_ID = hu.manual.sections[0]?.id ?? "";

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

function sectionOf(hash: string): string {
  return hu.manual.sections.some((section) => section.id === hash) ? hash : FIRST_ID;
}

export function ManualPage() {
  const selected = sectionOf(useLocation({ select: (location) => location.hash }));
  const navigate = useNavigate();
  const select = (key: string) => {
    void navigate({ to: "/manual", hash: key, replace: true, resetScroll: false });
  };
  return (
    <div className="manual-page">
      <LocationPlate name={hu.signs.manual} />
      <Tabs
        orientation="vertical"
        selectedKey={selected}
        onSelectionChange={(key) => select(String(key))}
        className="manual-layout"
      >
        <div className="manual-lift">
          <TabList aria-label={hu.manual.tocLabel} className="manual-lift-list">
            {hu.manual.sections.map((section, index) => (
              <Tab key={section.id} id={section.id} className="manual-lift-stop">
                <span aria-hidden="true" className="manual-lift-no">
                  {String(index + 1).padStart(2, "0")}
                </span>
                {section.title}
              </Tab>
            ))}
          </TabList>
          <RecipesEntry />
          <TourRestart />
        </div>
        {hu.manual.sections.map((section, index) => (
          <TabPanel key={section.id} id={section.id} className="manual-article">
            <Section section={section} index={index} />
          </TabPanel>
        ))}
      </Tabs>
    </div>
  );
}
