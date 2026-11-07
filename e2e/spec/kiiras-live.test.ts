import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import { randomBytes } from "node:crypto";
import { Client } from "./client.ts";

setDefaultTimeout(60_000);

const BASE = new URL(
  process.env.KIIRAS_TARGET ?? process.env.TEST_CONSOLE_TARGET ?? "http://127.0.0.1:8080",
);
const SEED_DEMO = { username: "demo1", password: "demo2026" };
const created: { client: Client; id: number }[] = [];

type MapBody = { map?: { id: number } };
type DetailBody = { version?: { id: number; content?: string } };
type RunBody = {
  run?: {
    gold: number;
    steps: number;
    errorCode: string | null;
    errorLine: number | null;
    outcomeKind: string;
  };
  console?: string[];
};
type BoardBody = { entries?: { username: string; gold: number; steps: number }[] };

async function account(): Promise<{ client: Client; username: string }> {
  const client = new Client(BASE);
  const username = `kiiras${randomBytes(4).toString("hex")}`;
  const password = `Kiiras-${randomBytes(9).toString("base64url")}`;
  const registered = await client.send("POST", "/api/auth/register", { username, password });
  if (registered.status >= 300)
    throw new Error(`A regisztráció nem sikerült: ${registered.status} ${registered.body}`);
  if (!client.cookie("ms_session"))
    await client.send("POST", "/api/auth/login", { username, password });
  return { client, username };
}

async function newMap(
  client: Client,
  content: string,
  visibility: "public" | "private" = "public",
) {
  const reply = await client.send("POST", "/api/maps", {
    title: `Kiírás ${randomBytes(3).toString("hex")}`,
    visibility,
    content,
  });
  const id = (reply.json as MapBody | null)?.map?.id;
  if (reply.status !== 201 || typeof id !== "number")
    throw new Error(`A térkép nem menthető: ${reply.status} ${reply.body.slice(0, 200)}`);
  created.push({ client, id });
  const detail = (await client.send("GET", `/api/maps/${id}`)).json as DetailBody;
  const versionId = detail.version?.id;
  if (typeof versionId !== "number") throw new Error("A térképnek nincs verziója.");
  return { id, versionId };
}

async function play(client: Client, versionId: number, source: string) {
  const reply = await client.send("POST", "/api/runs", { mapVersionId: versionId, source });
  return { status: reply.status, body: reply.json as RunBody, text: reply.body };
}

let reachable = false;

beforeAll(async () => {
  try {
    reachable = (await fetch(new URL("/api/health", BASE), { signal: AbortSignal.timeout(5000) }))
      .ok;
  } catch {
    reachable = false;
  }
  if (!reachable)
    throw new Error(
      `Nem fut alkalmazás a(z) ${BASE.origin} címen: indítsd el, mielőtt a kiírás élő tesztjeit futtatod.`,
    );
});

afterAll(async () => {
  for (const { client, id } of created)
    await client.send("DELETE", `/api/maps/${id}`).catch(() => undefined);
});

describe("3.1 Bejelentkezés és felhasználókezelés", () => {
  for (const path of ["/api/maps", "/api/programs", "/api/me/runs", "/api/auth/me"]) {
    test(`[3.1] a funkciók csak bejelentkezés után érhetők el: ${path} → 401`, async () => {
      expect((await new Client(BASE).send("GET", path)).status).toBe(401);
    });
  }

  test("[3.1] bejelentkezés nélkül futás nem rögzíthető → 401", async () => {
    expect(
      (await new Client(BASE).send("POST", "/api/runs", { mapVersionId: 1, source: "" })).status,
    ).toBe(401);
  });

  test("[3.1] regisztráció és bejelentkezés után a funkciók elérhetők", async () => {
    const { client } = await account();
    expect((await client.send("GET", "/api/maps")).status).toBe(200);
    expect((await client.send("GET", "/api/auth/me")).status).toBe(200);
  });
});

describe("3.2 A térképszerkesztő: csak szabályos térkép menthető", () => {
  const INVALID: [string, string][] = [
    ["0 sor", "0 1\n"],
    ["16 oszlop", `1 16\n>${".".repeat(15)}\n`],
    ["16 sor", `16 1\n>\n${".\n".repeat(15)}`],
    ["nincs robot", "1 2\n..\n"],
    ["két robot", "1 2\n><\n"],
    ["a sorok száma nem egyezik", "2 2\n>.\n"],
    ["a sor hossza nem egyezik", "1 3\n>.\n"],
    ["ismeretlen karakter", "1 2\n>x\n"],
  ];
  for (const [name, content] of INVALID) {
    test(`[3.2] nem menthető, érthető hibaüzenettel: ${name}`, async () => {
      const { client } = await account();
      const reply = await client.send("POST", "/api/maps", {
        title: "Hibás térkép",
        visibility: "private",
        content,
      });
      expect(`${name}: ${reply.status}`).toBe(`${name}: 422`);
      expect(reply.body).toMatch(/[áéíóöőúüű]/);
    });
  }

  test("[3.2] a szabályos térkép menthető, és pontosan a mentett formátumban exportálható", async () => {
    const { client } = await account();
    const content = "3 15\n....@..........\n.#############.\n.......@...>...\n";
    const { id } = await newMap(client, content, "private");
    const exported = await client.send("GET", `/api/maps/${id}/export`);
    expect(exported.status).toBe(200);
    expect(exported.body).toBe(content);
  });

  test("[3.2] egy meglévő térkép hibás tartalomra nem módosítható", async () => {
    const { client } = await account();
    const { id } = await newMap(client, "1 2\n>.\n", "private");
    const reply = await client.send("PUT", `/api/maps/${id}`, { content: "1 2\n..\n" });
    expect(reply.status).toBe(422);
    expect((await client.send("GET", `/api/maps/${id}/export`)).body).toBe("1 2\n>.\n");
  });
});

describe("3.3 A programkód szerkesztése", () => {
  test("[3.3] a szerkesztés közben még hibás program is menthető, és bájtra azonosan visszakapható", async () => {
    const { client } = await account();
    const source = "set arany to isThere 2\nprint  arany\n";
    const saved = await client.send("POST", "/api/programs", { title: "Félkész", source });
    expect(saved.status).toBe(201);
    const id = (saved.json as { program?: { id: number } }).program?.id;
    const loaded = await client.send("GET", `/api/programs/${id}`);
    expect((loaded.json as { program?: { source: string } }).program?.source).toBe(source);
    await client.send("DELETE", `/api/programs/${id}`);
  });
});

describe("3.4 A program futtatása", () => {
  test("[3.4] szintaktikailag hibás program nem futtatható: 422, a hibás sor jelölve, és nem kerül a futások közé", async () => {
    const { client } = await account();
    const { versionId } = await newMap(client, "1 2\n>@\n", "private");
    const reply = await play(client, versionId, "print 1\nprint  2");
    expect(reply.status).toBe(422);
    expect(reply.text).toMatch(/"line":\s*2/);
    const mine = (await client.send("GET", "/api/me/runs")).json as { runs?: unknown[] };
    expect(mine.runs ?? []).toHaveLength(0);
  });

  test("[3.4] a futás eredménye a kiírás sétáló programjára: 2 arany, 35 lépés, a konzolon 2", async () => {
    const { client } = await account();
    const { versionId } = await newMap(client, "1 6\n>.@.@#\n", "private");
    const walk = [
      "set count to 0",
      "set fal to isThere 1",
      "set megy to not fal",
      "while megy",
      "  set arany to isThere 2",
      "  if arany",
      "    step forward 1",
      "    mine here",
      "    set count to count + 1",
      "  else",
      "    step forward 1",
      "  set fal to isThere 1",
      "  set megy to not fal",
      "print count",
    ].join("\n");
    const reply = await play(client, versionId, walk);
    expect(reply.status).toBe(201);
    expect(reply.body.run).toMatchObject({ gold: 2, steps: 35, errorCode: null });
    expect(reply.body.console).toEqual(["2"]);
  });

  test("[3.4] futásidejű hibánál a hibakód és a hibás sor rögzül", async () => {
    const { client } = await account();
    const { versionId } = await newMap(client, "1 2\n>#\n", "private");
    const reply = await play(client, versionId, "print 1\nstep forward 1\nprint 2");
    expect(reply.status).toBe(201);
    expect(reply.body.run).toMatchObject({ errorCode: "E_BEDROCK_HIT", errorLine: 2, steps: 2 });
  });

  test("[3.4] legfeljebb 1000 programsor dolgozható fel: INSTRUCTION_COUNT_LIMIT_EXCEEDED, 1000 lépés", async () => {
    const { client } = await account();
    const { versionId } = await newMap(client, "1 1\n>\n", "private");
    const reply = await play(client, versionId, "while true\n  print 1");
    expect(reply.status).toBe(201);
    expect(reply.body.run).toMatchObject({
      errorCode: "INSTRUCTION_COUNT_LIMIT_EXCEEDED",
      steps: 1000,
    });
  });

  test("[3] minden futás alaphelyzetből indul: ugyanaz az arany kétszer is kibányászható", async () => {
    const { client } = await account();
    const { versionId } = await newMap(client, "1 2\n>@\n", "private");
    const first = await play(client, versionId, "step forward 1\nmine here");
    const second = await play(client, versionId, "step forward 1\nmine here");
    expect([first.body.run?.gold, second.body.run?.gold, second.body.run?.errorCode]).toEqual([
      1,
      1,
      null,
    ]);
  });
});

describe("3.5 A ranglista", () => {
  test("[3.5] térképenként: több arany előrébb, azonos aranynál kevesebb lépés előrébb", async () => {
    const owner = await account();
    const { id, versionId } = await newMap(owner.client, "1 4\n>@@.\n", "public");
    const fast = await account();
    const slow = await account();
    const weak = await account();
    expect((await play(weak.client, versionId, "step forward 1\nmine here")).status).toBe(201);
    expect(
      (
        await play(
          slow.client,
          versionId,
          "print 0\nstep forward 1\nmine here\nstep forward 1\nmine here",
        )
      ).status,
    ).toBe(201);
    expect(
      (await play(fast.client, versionId, "step forward 1\nmine here\nstep forward 1\nmine here"))
        .status,
    ).toBe(201);
    const board = (await owner.client.send("GET", `/api/maps/${id}/leaderboard`)).json as BoardBody;
    const order = (board.entries ?? []).map(
      (entry) => `${entry.username}:${entry.gold}/${entry.steps}`,
    );
    expect(order).toEqual([`${fast.username}:2/4`, `${slow.username}:2/5`, `${weak.username}:1/2`]);
  });

  test("[3.5] a futás a felhasználóhoz kötve rögzül: a saját futások között megjelenik", async () => {
    const { client } = await account();
    const { versionId } = await newMap(client, "1 2\n>@\n", "private");
    await play(client, versionId, "step forward 1\nmine here");
    const mine = (await client.send("GET", "/api/me/runs")).json as {
      runs?: { gold: number; steps: number }[];
    };
    expect(mine.runs?.[0]).toMatchObject({ gold: 1, steps: 2 });
  });
});

describe("4. Beadandó: a bemutatáshoz kész játékkörnyezet", () => {
  test("[4] a bemutató verzióban van kész játékkörnyezet: a demófiókkal belépve vannak pályák", async () => {
    const client = new Client(BASE);
    const login = await client.send("POST", "/api/auth/login", SEED_DEMO);
    expect(login.status).toBe(200);
    const maps = (await client.send("GET", "/api/maps")).json as { maps?: unknown[] };
    expect((maps.maps ?? []).length).toBeGreaterThan(0);
  });
});
