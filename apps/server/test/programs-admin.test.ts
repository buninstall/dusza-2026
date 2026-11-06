import { describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { users } from "../src/db/schema.ts";
import { createTestContext, json } from "./helpers.ts";

describe("programok", () => {
  test("létrehozás, módosítás, törlés csak a sajátra", async () => {
    await using context = await createTestContext();
    const owner = context.client();
    await owner.register("programozo");
    const created = await json<{ program: { id: number } }>(
      await owner.post("/api/programs", { title: "Első", source: "print 1\n" }),
    );
    const id = created.program.id;
    const updated = await owner.put(`/api/programs/${id}`, { source: "print 2\n" });
    expect(updated.status).toBe(200);
    const fetched = await json<{ program: { source: string } }>(
      await owner.get(`/api/programs/${id}`),
    );
    expect(fetched.program.source).toBe("print 2\n");

    const other = context.client();
    await other.register("kivancsi");
    expect((await other.get(`/api/programs/${id}`)).status).toBe(404);
    expect((await owner.delete(`/api/programs/${id}`)).status).toBe(200);
    const list = await json<{ programs: unknown[] }>(await owner.get("/api/programs"));
    expect(list.programs).toHaveLength(0);
  });
});

describe("adminisztráció", () => {
  test("csak admin éri el, és a saját szerepét nem módosíthatja", async () => {
    await using context = await createTestContext();
    const admin = context.client();
    const { user: adminUser } = await admin.register("fonok");
    const player = context.client();
    const { user: playerUser } = await player.register("jatekos");
    expect((await player.get("/api/admin/users")).status).toBe(403);

    await context.deps.db.update(users).set({ role: "admin" }).where(eq(users.id, adminUser.id));
    const list = await json<{ users: { username: string }[] }>(await admin.get("/api/admin/users"));
    expect(list.users.map((u) => u.username)).toEqual(["fonok", "jatekos"]);

    const promote = await admin.request("PATCH", `/api/admin/users/${playerUser.id}`, {
      role: "admin",
    });
    expect(promote.status).toBe(200);
    const self = await admin.request("PATCH", `/api/admin/users/${adminUser.id}`, { role: "user" });
    expect(self.status).toBe(409);
    expect((await admin.delete(`/api/admin/users/${playerUser.id}`)).status).toBe(200);
  });

  test("nem létező felhasználó módosítása és törlése 404", async () => {
    await using context = await createTestContext();
    const admin = context.client();
    const { user } = await admin.register("fonok");
    await context.deps.db.update(users).set({ role: "admin" }).where(eq(users.id, user.id));
    const missing = `/api/admin/users/${user.id + 1000}`;
    expect((await admin.request("PATCH", missing, { role: "admin" })).status).toBe(404);
    expect((await admin.delete(missing)).status).toBe(404);
  });
});
