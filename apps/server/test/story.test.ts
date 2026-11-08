import { describe, expect, test } from "bun:test";
import { seedDemo } from "../src/seed/index.ts";
import { chapterReached } from "../src/services/story.ts";
import { createTestContext, json } from "./helpers.ts";

type Board = {
  maxStars: number;
  chapters: number;
  entries: {
    rank: number;
    username: string;
    stars: number;
    gold: number;
    steps: number;
    cleared: number;
    chapter: number;
  }[];
};

describe("történet-ranglista", () => {
  test("a kampánypályák legjobb futásait összesíti, rög szerint rendezve", async () => {
    await using context = await createTestContext();
    await seedDemo(context.deps, { reset: false });
    const demo = context.client();
    await demo.post("/api/auth/login", { username: "demo1", password: "demo2026" });
    const board = await json<Board>(await demo.get("/api/story/leaderboard"));
    expect(board.maxStars).toBe(90);
    expect(board.chapters).toBe(6);
    expect(board.entries.map((entry) => entry.username)).toEqual(["demo1", "demo2", "demo3"]);
    expect(board.entries[0]).toMatchObject({
      rank: 1,
      stars: 6,
      gold: 4,
      steps: 9,
      cleared: 2,
      chapter: 1,
    });
    expect(board.entries[2]).toMatchObject({ stars: 1, gold: 1 });
  });

  test("bejelentkezés nélkül nem érhető el", async () => {
    await using context = await createTestContext();
    const response = await context.client().get("/api/story/leaderboard");
    expect(response.status).toBe(401);
  });

  test("a fejezet akkor nyílik, ha az előző minden pályája kész", () => {
    const all = (count: number) => new Set(Array.from({ length: count }, (_, index) => index));
    expect(chapterReached(new Set(), 30)).toBe(1);
    expect(chapterReached(all(4), 30)).toBe(1);
    expect(chapterReached(all(5), 30)).toBe(2);
    expect(chapterReached(new Set([0, 1, 2, 3, 4, 6, 7, 8, 9]), 30)).toBe(2);
    expect(chapterReached(all(30), 30)).toBe(6);
  });
});
