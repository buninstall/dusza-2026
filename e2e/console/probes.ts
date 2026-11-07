import { randomBytes } from "node:crypto";
import type { Severity, TestCase } from "./parsers.ts";

type Reply = { status: number; headers: Headers; body: string; json: unknown };

export class Client {
  private cookies = new Map<string, string>();
  readonly setCookies: string[] = [];

  constructor(private readonly base: URL) {}

  cookie(name: string): string | undefined {
    return this.cookies.get(name);
  }

  setCookie(name: string, value: string): void {
    this.cookies.set(name, value);
  }

  async send(
    method: string,
    path: string,
    body?: unknown,
    headers: Record<string, string> = {},
  ): Promise<Reply> {
    const cookie = [...this.cookies].map(([key, value]) => `${key}=${value}`).join("; ");
    const response = await fetch(new URL(path, this.base), {
      method,
      redirect: "manual",
      signal: AbortSignal.timeout(30_000),
      headers: {
        Origin: this.base.origin,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(cookie ? { Cookie: cookie } : {}),
        ...headers,
      },
      ...(body === undefined
        ? {}
        : { body: typeof body === "string" ? body : JSON.stringify(body) }),
    });
    for (const header of response.headers.getSetCookie()) {
      this.setCookies.push(header);
      const [pair = ""] = header.split(";");
      const [name = "", ...rest] = pair.split("=");
      const value = rest.join("=");
      if (/max-age=0|expires=thu, 01 jan 1970/i.test(header) || value === "")
        this.cookies.delete(name.trim());
      else this.cookies.set(name.trim(), value);
    }
    const text = await response.text();
    let json: unknown = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
    return { status: response.status, headers: response.headers, body: text, json };
  }
}

const unique = () => `konzol${Date.now().toString(36)}${randomBytes(3).toString("hex")}`;
const secret = () => `Pw-${randomBytes(12).toString("base64url")}`;

async function account(base: URL, extra: Record<string, unknown> = {}) {
  const client = new Client(base);
  const username = unique();
  const password = secret();
  const registered = await client.send("POST", "/api/auth/register", {
    username,
    password,
    ...extra,
  });
  if (registered.status >= 300)
    throw new Error(
      `A regisztráció nem sikerült (${registered.status}): ${registered.body.slice(0, 200)}`,
    );
  if (!client.cookie("ms_session")) {
    const login = await client.send("POST", "/api/auth/login", { username, password });
    if (login.status !== 200) throw new Error(`A bejelentkezés nem sikerült (${login.status})`);
  }
  return { client, username, password, registered };
}

type MapSummary = { id: number; title: string; versionId: number };

async function anyPublicMap(client: Client): Promise<MapSummary> {
  const reply = await client.send("GET", "/api/maps");
  const maps = (reply.json as { maps?: MapSummary[] } | null)?.maps ?? [];
  const map = maps.find((candidate) => typeof candidate.versionId === "number");
  if (!map) throw new Error("Nincs nyilvános térkép a célpéldányon.");
  return map;
}

type WriteProbe = { name: string; severity: Severity; run: (base: URL) => Promise<string | null> };

const MINI_MAP = "1 2\n>@\n";

export const WRITE_PROBES: WriteProbe[] = [
  {
    name: "Regisztráció: védett munkamenet-süti, a jelszó és a hash nem kerül a válaszba",
    severity: "magas",
    run: async (base) => {
      const { client, password, registered } = await account(base);
      const problems: string[] = [];
      const cookie = client.setCookies.find((header) => header.startsWith("ms_session=")) ?? "";
      if (!cookie) problems.push("Nem jött ms_session süti.");
      if (!/;\s*httponly/i.test(cookie)) problems.push("A munkamenet-süti nem HttpOnly.");
      if (!/;\s*samesite=(lax|strict)/i.test(cookie))
        problems.push("A munkamenet-süti SameSite értéke nem Lax/Strict.");
      if (base.protocol === "https:" && !/;\s*secure/i.test(cookie))
        problems.push("HTTPS alatt a süti nem Secure.");
      const me = await client.send("GET", "/api/auth/me");
      for (const reply of [registered, me]) {
        if (reply.body.includes(password)) problems.push("A nyílt jelszó megjelenik a válaszban.");
        if (/\$argon2|\$2[aby]\$|"password(Hash)?"\s*:/i.test(reply.body))
          problems.push("Jelszó-hash vagy jelszómező a válaszban.");
      }
      return problems.length ? problems.join("\n") : null;
    },
  },
  {
    name: "Kijelentkezés után a régi munkamenet-süti érvénytelen",
    severity: "blokkoló",
    run: async (base) => {
      const { client } = await account(base);
      const token = client.cookie("ms_session") ?? "";
      await client.send("POST", "/api/auth/logout");
      const replay = new Client(base);
      replay.setCookie("ms_session", token);
      const reply = await replay.send("GET", "/api/auth/me");
      return reply.status === 401
        ? null
        : `A kijelentkezett süti még mindig működik: ${reply.status}`;
    },
  },
  {
    name: "Munkamenet-rögzítés: bejelentkezéskor új munkamenet-azonosító keletkezik",
    severity: "magas",
    run: async (base) => {
      const { username, password } = await account(base);
      const victim = new Client(base);
      victim.setCookie("ms_session", "rogzitett-ismert-ertek");
      await victim.send("POST", "/api/auth/login", { username, password });
      const issued = victim.cookie("ms_session");
      return issued && issued !== "rogzitett-ismert-ertek"
        ? null
        : "A szerver megtartotta a kliens által előre beállított munkamenet-azonosítót.";
    },
  },
  {
    name: "Tömeges értékadás: a regisztrációban küldött admin szerep nem ad jogot",
    severity: "blokkoló",
    run: async (base) => {
      const { client } = await account(base, {
        role: "admin",
        isAdmin: true,
        admin: true,
        userId: 1,
      });
      const reply = await client.send("GET", "/api/admin/users");
      return reply.status === 403 || reply.status === 404
        ? null
        : `A kliens által küldött szerep után az admin végpont válasza ${reply.status}.`;
    },
  },
  {
    name: "Felhasználónév-ütközés kis- és nagybetűvel",
    severity: "közepes",
    run: async (base) => {
      const name = unique();
      const first = await new Client(base).send("POST", "/api/auth/register", {
        username: name,
        password: secret(),
      });
      if (first.status >= 300) return `Az első regisztráció sem sikerült: ${first.status}`;
      const second = await new Client(base).send("POST", "/api/auth/register", {
        username: name.toUpperCase(),
        password: secret(),
      });
      return second.status >= 400 && second.status < 500
        ? null
        : `A csak betűméretben eltérő név is regisztrálható: ${second.status}`;
    },
  },
  {
    name: "IDOR: más felhasználó privát térképe nem olvasható, nem exportálható, nem törölhető",
    severity: "blokkoló",
    run: async (base) => {
      const owner = await account(base);
      const created = await owner.client.send("POST", "/api/maps", {
        title: "Konzol IDOR próba",
        visibility: "private",
        content: MINI_MAP,
      });
      const body = created.json as { map?: { id: number }; id?: number } | null;
      const id = body?.map?.id ?? body?.id;
      if (created.status !== 201 || typeof id !== "number")
        return `A privát térkép nem hozható létre: ${created.status} ${created.body.slice(0, 160)}`;
      const other = await account(base);
      const problems: string[] = [];
      for (const path of [
        `/api/maps/${id}`,
        `/api/maps/${id}/export`,
        `/api/maps/${id}/leaderboard`,
      ]) {
        const reply = await other.client.send("GET", path);
        if (reply.status < 400) problems.push(`GET ${path} → ${reply.status}`);
      }
      const removal = await other.client.send("DELETE", `/api/maps/${id}`);
      if (removal.status < 400) problems.push(`DELETE /api/maps/${id} → ${removal.status}`);
      const still = await owner.client.send("GET", `/api/maps/${id}`);
      if (still.status !== 200)
        problems.push(`A tulajdonos sem éri el a saját térképét: ${still.status}`);
      await owner.client.send("DELETE", `/api/maps/${id}`);
      return problems.length
        ? `Más felhasználó hozzáfér a privát térképhez:\n${problems.join("\n")}`
        : null;
    },
  },
  {
    name: "Ranglista-hamisítás: a kliens által küldött arany és lépésszám figyelmen kívül marad",
    severity: "blokkoló",
    run: async (base) => {
      const { client } = await account(base);
      const map = await anyPublicMap(client);
      const reply = await client.send("POST", "/api/runs", {
        mapVersionId: map.versionId,
        source: "",
        gold: 999,
        steps: 1,
        errorCode: null,
      });
      if (reply.status === 400) return null;
      const run = (reply.json as { run?: { gold?: number; steps?: number } } | null)?.run;
      if (reply.status !== 201 || !run)
        return `Váratlan válasz: ${reply.status} ${reply.body.slice(0, 160)}`;
      return run.gold === 0 && run.steps === 0
        ? null
        : `A szerver elfogadta a kliens eredményét: gold ${run.gold}, steps ${run.steps}`;
    },
  },
  {
    name: "Versenyhelyzet: 12 párhuzamos azonos beküldés konzisztens eredményt ad",
    severity: "magas",
    run: async (base) => {
      const { client, username } = await account(base);
      const map = await anyPublicMap(client);
      const replies = await Promise.all(
        Array.from({ length: 12 }, () =>
          client.send("POST", "/api/runs", { mapVersionId: map.versionId, source: "print 1\n" }),
        ),
      );
      const statuses = replies.map((reply) => reply.status);
      if (statuses.some((status) => status >= 500))
        return `Szerverhiba párhuzamos beküldésnél: ${statuses.join(", ")}`;
      const results = new Set(
        replies
          .filter((reply) => reply.status !== 429)
          .map((reply) => {
            const run = (reply.json as { run?: { gold?: number; steps?: number } } | null)?.run;
            return `${reply.status}:${run?.gold ?? "-"}:${run?.steps ?? "-"}`;
          }),
      );
      if (results.size > 1)
        return `Azonos bemenetre eltérő eredmények: ${[...results].join(" | ")}`;
      const board = await client.send("GET", `/api/maps/${map.id}/leaderboard`);
      const entries = board.body.split(`"${username}"`).length - 1;
      return entries <= 1
        ? null
        : `A ranglistán a felhasználó ${entries}-szer szerepel (D13: felhasználónként a legjobb futás).`;
    },
  },
  {
    name: "Óriási program beküldése: elutasítva vagy korlátozva, a szerver életben marad",
    severity: "magas",
    run: async (base) => {
      const { client } = await account(base);
      const map = await anyPublicMap(client);
      let status = "kapcsolat bontva";
      try {
        const reply = await client.send("POST", "/api/runs", {
          mapVersionId: map.versionId,
          source: "print 1\n".repeat(300_000),
        });
        status = String(reply.status);
        if (reply.status >= 500) return `300 000 soros program → ${reply.status}`;
      } catch {
        status = "kapcsolat bontva";
      }
      const health = await new Client(base).send("GET", "/api/health");
      return health.status === 200
        ? null
        : `Az óriási program (${status}) után a szerver nem egészséges: ${health.status}`;
    },
  },
  {
    name: "Tárolt XSS: a térképcímben küldött HTML JSON-ként, nem HTML-ként tér vissza",
    severity: "magas",
    run: async (base) => {
      const { client } = await account(base);
      const payload = `<img src=x onerror=alert(1)>"'><svg/onload=alert(2)>`;
      const created = await client.send("POST", "/api/maps", {
        title: payload.slice(0, 60),
        description: payload,
        visibility: "private",
        content: MINI_MAP,
      });
      const id = (created.json as { map?: { id: number } } | null)?.map?.id;
      if (created.status >= 500) return `HTML-t tartalmazó cím → ${created.status}`;
      if (typeof id !== "number") return null;
      const reply = await client.send("GET", `/api/maps/${id}`);
      await client.send("DELETE", `/api/maps/${id}`);
      const type = reply.headers.get("content-type") ?? "";
      return type.includes("application/json")
        ? null
        : `A térkép válaszának típusa ${type}, nem JSON.`;
    },
  },
];

export async function probeWrites(
  base: URL,
  log: (line: string) => void,
  signal: AbortSignal,
): Promise<TestCase[]> {
  const cases: TestCase[] = [];
  for (const probe of WRITE_PROBES) {
    if (signal.aborted) break;
    const started = performance.now();
    log(`▶ ${probe.name}`);
    let problem: string | null;
    try {
      problem = await probe.run(base);
    } catch (error) {
      problem = `A próba nem futott le: ${error instanceof Error ? error.message : String(error)}`;
    }
    log(problem ? `  ✗ ${problem.replaceAll("\n", "\n    ")}` : "  ✓ rendben");
    cases.push({
      key: `write::${probe.name}`,
      name: probe.name,
      file: null,
      line: null,
      status: problem ? "failed" : "passed",
      durationMs: Math.round(performance.now() - started),
      message: problem?.split("\n")[0] ?? null,
      details: problem,
      ...(problem ? { severity: probe.severity } : {}),
    });
  }
  return cases;
}
