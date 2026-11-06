import { describe, expect, test, vi } from "vitest";
import { ApiError } from "../src/lib/api.ts";
import { isServerTrouble } from "../src/lib/query.ts";
import {
  createResilientFetch,
  type FetchLike,
  RETRY_SAFE_HEADER,
} from "../src/lib/resilient-fetch.ts";

const DELAYS = [1, 2, 3];

function sequence(...replies: (Response | Error)[]): FetchLike {
  let index = 0;
  return vi.fn(async () => {
    const reply = replies[Math.min(index, replies.length - 1)];
    index += 1;
    if (reply instanceof Error) {
      throw reply;
    }
    return reply?.clone() ?? new Response(null, { status: 599 });
  });
}

function status(code: number, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify({ ok: code < 400 }), { status: code, headers });
}

describe("újrapróbáló kérés", () => {
  test("újrainduló szervernél a GET kivárja, amíg ismét válaszol", async () => {
    const base = sequence(new TypeError("offline"), status(502), status(503), status(200));
    const wait = vi.fn(async () => undefined);
    const response = await createResilientFetch({ base, wait, delays: DELAYS })("/api/maps/1");
    expect(response.status).toBe(200);
    expect(base).toHaveBeenCalledTimes(4);
    expect(wait.mock.calls.map(([ms]) => ms)).toEqual([1, 2, 3]);
  });

  test("a 4xx választ nem ismétli", async () => {
    const base = sequence(status(404), status(200));
    const response = await createResilientFetch({
      base,
      wait: async () => undefined,
      delays: DELAYS,
    })("/api/maps/99");
    expect(response.status).toBe(404);
    expect(base).toHaveBeenCalledTimes(1);
  });

  test("a módosító kérést csak akkor ismétli, ha biztosan el sem jutott a szerverig", async () => {
    const quick = { wait: async () => undefined, delays: DELAYS };
    const failed = sequence(status(503), status(201));
    const kept = await createResilientFetch({ base: failed, ...quick })("/api/runs", {
      method: "POST",
    });
    expect(kept.status).toBe(503);
    expect(failed).toHaveBeenCalledTimes(1);

    const refused = sequence(status(503, { [RETRY_SAFE_HEADER]: "1" }), status(201));
    const sent = await createResilientFetch({ base: refused, ...quick })("/api/runs", {
      method: "POST",
    });
    expect(sent.status).toBe(201);
    expect(refused).toHaveBeenCalledTimes(2);

    const offline = sequence(new TypeError("offline"), status(201));
    await expect(
      createResilientFetch({ base: offline, ...quick })("/api/runs", { method: "POST" }),
    ).rejects.toThrow("offline");
    expect(offline).toHaveBeenCalledTimes(1);
  });

  test("ha a szerver végig nem válaszol, az utolsó választ adja tovább", async () => {
    const base = sequence(status(500));
    const response = await createResilientFetch({
      base,
      wait: async () => undefined,
      delays: DELAYS,
    })("/api/maps");
    expect(response.status).toBe(500);
    expect(base).toHaveBeenCalledTimes(DELAYS.length + 1);
  });

  test("a szerverhibát és a hálózati hibát átmeneti zavarnak tekinti", () => {
    expect(isServerTrouble(new ApiError(0, "NETWORK", "x"))).toBe(true);
    expect(isServerTrouble(new ApiError(503, "UNAVAILABLE", "x"))).toBe(true);
    expect(isServerTrouble(new ApiError(404, "NOT_FOUND", "x"))).toBe(false);
    expect(isServerTrouble(new Error("x"))).toBe(false);
  });
});
