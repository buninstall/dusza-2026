import { describe, expect, test } from "vitest";
import { CHAPTERS } from "../src/i18n/hu-story.ts";
import { groupCampaign, isCampaignMap } from "../src/maps/campaign.ts";
import type { MapSummary } from "../src/maps/queries.ts";
import { MAP_RECIPES } from "../src/recipes/catalog.ts";
import { mapSummary } from "./support/fixtures.ts";

const CORRIDOR = "1 8\n>..@..@.\n";

function campaign(stars: (index: number) => number): MapSummary[] {
  return CHAPTERS.flatMap((chapter, c) =>
    chapter.levels.map((title, k) => {
      const index = c * 5 + k;
      return { ...mapSummary(index + 1, title, CORRIDOR), isStory: true, stars: stars(index) };
    }),
  );
}

describe("kampány fejezetei", () => {
  test("hat fejezet, mindegyikben öt pálya, és mindhez van recept", () => {
    expect(CHAPTERS).toHaveLength(6);
    const titles = CHAPTERS.flatMap((chapter) => chapter.levels);
    expect(titles).toHaveLength(30);
    const story = new Set(
      MAP_RECIPES.filter((recipe) => recipe.world === "story").map((recipe) => recipe.title),
    );
    for (const title of titles) expect(story.has(title)).toBe(true);
  });

  test("új játékosnak csak az első fejezet nyitott, a többi lakatos", () => {
    const { groups, lockedIds, isSilent } = groupCampaign(campaign(() => 0));
    expect(groups.map((group) => group.lock === null)).toEqual([
      true,
      false,
      false,
      false,
      false,
      false,
    ]);
    expect(groups.map((group) => group.lock?.remaining ?? 0)).toEqual([0, 5, 10, 15, 20, 25]);
    expect(groups[2]?.lock?.isChained).toBe(true);
    expect(lockedIds.size).toBe(25);
    expect(isSilent).toBe(false);
  });

  test("a fejezet akkor nyílik, ha az előző minden pályáján megvan minden arany", () => {
    const fourDone = groupCampaign(campaign((index) => (index < 4 || index === 6 ? 2 : 1)));
    expect(fourDone.groups[1]?.lock?.remaining).toBe(1);
    expect(fourDone.groups[2]?.lock?.remaining).toBe(5);
    const allDone = groupCampaign(campaign((index) => (index < 5 ? 3 : 0)));
    expect(allDone.groups[1]?.lock).toBeNull();
    expect(allDone.groups[2]?.lock).toMatchObject({ remaining: 5, isChained: false });
  });

  test("a Szív utolsó rögével elhallgat a kopogás", () => {
    const done = groupCampaign(campaign(() => 2));
    expect(done.groups.every((group) => group.lock === null)).toBe(true);
    expect(done.isSilent).toBe(true);
  });

  test("a homokozó pályái nem tartoznak a kampányhoz", () => {
    const own = { ...mapSummary(99, "1. Egyenes folyosó", CORRIDOR), isStory: false };
    expect(isCampaignMap(own)).toBe(false);
    const { groups } = groupCampaign([own]);
    expect(groups).toHaveLength(0);
  });
});
