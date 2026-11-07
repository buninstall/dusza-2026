import type { Severity } from "./parsers.ts";
import { findings, type Run, runs } from "./store.ts";
import { SUITES } from "./suites.ts";

const SEVERITIES: Severity[] = ["blokkoló", "magas", "közepes", "alacsony"];
const OPEN = new Set(["új", "megerősítve", "jelentve"]);
const SPEC_SUITES = ["kiiras-engine", "kiiras-live", "kiiras-beadando", "kiiras-ui"];
const CHAPTER_TITLES: Record<string, string> = {
  "1": "A térkép és a program formátuma",
  "2": "A szöveges forráskód nyelvtana",
  "2.1": "Soronkénti feldolgozás, tokenizálás",
  "2.2.1": "Kulcsszavak működése",
  "2.2.2": "A nyelv alapszabályai",
  "2.2.3": "Robot API",
  "2.2.4": "Futásidejű hibák",
  "3": "A játék működése",
  "3.1": "Bejelentkezés és felhasználókezelés",
  "3.2": "A térképszerkesztő",
  "3.3": "A programkód szerkesztése",
  "3.4": "A program futtatása",
  "3.5": "A ranglista",
  "4": "Beadandó",
};

export type SuiteState = {
  id: string;
  group: string;
  title: string;
  status: Run["status"] | "never";
  finishedAt: number | null;
  counts: Run["counts"] | null;
  durationMs: number | null;
  failures: { name: string; message: string | null; location: string | null }[];
};

export type Summary = {
  generatedAt: number;
  verdict: { level: "green" | "amber" | "red"; headline: string; text: string };
  totals: {
    suites: number;
    green: number;
    red: number;
    never: number;
    passedCases: number;
    failedCases: number;
    openFindings: Record<Severity, number>;
    flaky: number;
  };
  good: string[];
  bad: string[];
  neverRun: string[];
  groups: { group: string; suites: SuiteState[] }[];
  spec: { chapter: string; title: string; passed: number; failed: number; failures: string[] }[];
  coverage: {
    suite: string;
    files: number;
    below: number;
    average: number | null;
    worst: { file: string; percent: number }[];
  }[];
  owners: { owner: string; open: number; blocking: number }[];
  flaky: { title: string; suiteId: string; history: string }[];
  recommendations: string[];
};

function latestFull(suiteId: string): Run | undefined {
  return [...runs]
    .filter(
      (run) =>
        run.suiteId === suiteId && !run.target && !["queued", "running"].includes(run.status),
    )
    .sort((a, b) => (b.finishedAt ?? 0) - (a.finishedAt ?? 0))[0];
}

function location(file: string | null, line: number | null): string | null {
  return file ? `${file}${line ? `:${line}` : ""}` : null;
}

function chapterOf(name: string): string[] {
  const match = name.match(/^\[([^\]]+)\]/);
  if (!match?.[1]) return [];
  return match[1].split(",").map((part) => part.trim());
}

export function buildSummary(): Summary {
  const states: SuiteState[] = SUITES.map((suite) => {
    const run = latestFull(suite.id);
    return {
      id: suite.id,
      group: suite.group,
      title: suite.title,
      status: run?.status ?? "never",
      finishedAt: run?.finishedAt ?? null,
      counts: run?.counts ?? null,
      durationMs: run?.startedAt && run.finishedAt ? run.finishedAt - run.startedAt : null,
      failures: (run?.cases ?? [])
        .filter((item) => item.status === "failed")
        .slice(0, 5)
        .map((item) => ({
          name: item.name,
          message: item.message,
          location: location(item.file, item.line),
        })),
    };
  });
  const green = states.filter((state) => state.status === "passed");
  const red = states.filter((state) => state.status === "failed" || state.status === "error");
  const never = states.filter((state) => state.status === "never" || state.status === "cancelled");
  const open = findings.filter((finding) => OPEN.has(finding.status));
  const openBySeverity = Object.fromEntries(
    SEVERITIES.map((severity) => [
      severity,
      open.filter((finding) => finding.severity === severity).length,
    ]),
  ) as Record<Severity, number>;
  const flaky = findings.filter((finding) => finding.flaky && finding.status !== "hamis riasztás");
  const passedCases = states.reduce((sum, state) => sum + (state.counts?.passed ?? 0), 0);
  const failedCases = states.reduce((sum, state) => sum + (state.counts?.failed ?? 0), 0);

  const chapters = new Map<string, { passed: number; failed: number; failures: string[] }>();
  for (const suiteId of SPEC_SUITES) {
    for (const item of latestFull(suiteId)?.cases ?? []) {
      const own = item.name.split(" › ").at(-1) ?? item.name;
      for (const chapter of chapterOf(own)) {
        const entry = chapters.get(chapter) ?? { passed: 0, failed: 0, failures: [] };
        if (item.status === "failed") {
          entry.failed += 1;
          entry.failures.push(`${own}: ${item.message ?? "sikertelen"}`);
        } else if (item.status === "passed") entry.passed += 1;
        chapters.set(chapter, entry);
      }
    }
  }
  const spec = Object.keys(CHAPTER_TITLES).map((chapter) => ({
    chapter,
    title: CHAPTER_TITLES[chapter] ?? chapter,
    passed: chapters.get(chapter)?.passed ?? 0,
    failed: chapters.get(chapter)?.failed ?? 0,
    failures: (chapters.get(chapter)?.failures ?? []).slice(0, 5),
  }));

  const coverage = SUITES.filter((suite) => suite.id.startsWith("coverage-")).map((suite) => {
    const run = latestFull(suite.id);
    const files = (run?.cases ?? [])
      .map((item) => ({
        file: item.file ?? item.name,
        percent: Number(item.name.match(/([\d.]+)% sorlefedettség/)?.[1] ?? "NaN"),
      }))
      .filter((item) => Number.isFinite(item.percent));
    return {
      suite: suite.title,
      files: files.length,
      below: (run?.cases ?? []).filter((item) => item.status === "failed").length,
      average: files.length
        ? Math.round((files.reduce((sum, item) => sum + item.percent, 0) / files.length) * 10) / 10
        : null,
      worst: [...files].sort((a, b) => a.percent - b.percent).slice(0, 5),
    };
  });

  const owners = [...new Set(open.map((finding) => finding.owner))].map((owner) => ({
    owner,
    open: open.filter((finding) => finding.owner === owner).length,
    blocking: open.filter(
      (finding) =>
        finding.owner === owner &&
        (finding.severity === "blokkoló" || finding.severity === "magas"),
    ).length,
  }));

  const good: string[] = [];
  const bad: string[] = [];
  for (const state of green) good.push(`${state.title}: ${state.counts?.passed ?? 0} eset sikeres`);
  for (const chapter of spec) {
    if (chapter.passed > 0 && chapter.failed === 0)
      good.push(
        `Kiírás ${chapter.chapter}. (${chapter.title}): mind a(z) ${chapter.passed} szabály teljesül`,
      );
  }
  for (const state of red) {
    const first = state.failures[0];
    bad.push(
      `${state.title}: ${state.counts?.failed ?? 0} sikertelen eset${first ? ` – például „${first.name}”${first.message ? `: ${first.message}` : ""}` : ""}`,
    );
  }
  for (const chapter of spec) {
    if (chapter.failed > 0)
      bad.push(`Kiírás ${chapter.chapter}. (${chapter.title}): ${chapter.failed} szabály sérül`);
  }
  if (openBySeverity.blokkoló > 0) bad.push(`${openBySeverity.blokkoló} blokkoló nyitott találat`);
  if (flaky.length > 0) bad.push(`${flaky.length} instabil teszt: hol sikeres, hol nem`);

  const recommendations: string[] = [];
  if (openBySeverity.blokkoló > 0)
    recommendations.push(
      "Először a blokkoló találatokat javítsátok: ezek a verseny pontjait közvetlenül érintik.",
    );
  if (openBySeverity.magas > 0)
    recommendations.push(
      `A ${openBySeverity.magas} magas súlyosságú találatot a felelősöknek érdemes most továbbítani (Találatok → Export → Markdown).`,
    );
  for (const owner of owners.filter((item) => item.blocking > 0)) {
    recommendations.push(`${owner.owner}: ${owner.blocking} magas vagy blokkoló találat vár rá.`);
  }
  if (flaky.length > 0)
    recommendations.push(
      "Az instabil teszteknél vizsgáljátok az időkorlátokat és a tesztek közötti függést; futtassátok az instabilitás-próbát.",
    );
  if (never.length > 0)
    recommendations.push(
      `${never.length} csomag még nem futott: ami nem futott, az nem bizonyított. Futtasd: ${never
        .slice(0, 4)
        .map((state) => state.title)
        .join("; ")}${never.length > 4 ? "…" : ""}.`,
    );
  const specMissing = spec.filter((chapter) => chapter.passed + chapter.failed === 0);
  if (specMissing.length > 0)
    recommendations.push(
      `A kiírás ${specMissing.map((chapter) => `${chapter.chapter}.`).join(", ")} fejezetéről még nincs friss eredmény: futtasd a „Versenykiírás (PDF)” csoportot.`,
    );
  for (const item of coverage.filter((entry) => entry.below > 0))
    recommendations.push(
      `${item.suite}: ${item.below} fájl 95% alatt van, írjatok tesztet a lefedetlen sorokra.`,
    );
  if (recommendations.length === 0)
    recommendations.push(
      "Minden lefuttatott csomag zöld és nincs nyitott találat: futtasd a hosszú csomagokat is (teljes e2e, mély fuzz, proptest) a teljes bizonyossághoz.",
    );

  const level: Summary["verdict"]["level"] =
    red.length > 0 || openBySeverity.blokkoló > 0
      ? "red"
      : never.length > 0 || open.length > 0 || flaky.length > 0
        ? "amber"
        : "green";
  const headline =
    level === "red"
      ? `${red.length} piros csomag, ${openBySeverity.blokkoló + openBySeverity.magas} komoly találat`
      : level === "amber"
        ? never.length > 0
          ? `Zöld, de ${never.length} csomag még nem futott`
          : `Zöld, ${open.length} nyitott találattal`
        : "Minden zöld";
  const text = `${green.length}/${states.length} csomag zöld, ${passedCases} sikeres és ${failedCases} sikertelen eset a legutóbbi teljes futásokban; ${open.length} nyitott találat (${SEVERITIES.map((severity) => `${openBySeverity[severity]} ${severity}`).join(", ")}), ${flaky.length} instabil teszt.`;

  const groups = [...new Set(states.map((state) => state.group))].map((group) => ({
    group,
    suites: states.filter((state) => state.group === group),
  }));

  return {
    generatedAt: Date.now(),
    verdict: { level, headline, text },
    totals: {
      suites: states.length,
      green: green.length,
      red: red.length,
      never: never.length,
      passedCases,
      failedCases,
      openFindings: openBySeverity,
      flaky: flaky.length,
    },
    good,
    bad,
    neverRun: never.map((state) => state.title),
    groups,
    spec,
    coverage,
    owners,
    flaky: flaky.slice(0, 20).map((finding) => ({
      title: finding.title,
      suiteId: finding.suiteId,
      history: finding.history.map((item) => (item === "failed" ? "✗" : "✓")).join(""),
    })),
    recommendations,
  };
}

const STATUS_TEXT: Record<SuiteState["status"], string> = {
  passed: "sikeres",
  failed: "sikertelen",
  error: "nem futott le",
  cancelled: "leállítva",
  queued: "sorban",
  running: "fut",
  never: "még nem futott",
};

export function summaryMarkdown(summary: Summary): string {
  const lines = [
    "# Tesztösszegzés – MineScript",
    "",
    `Készült: ${new Date(summary.generatedAt).toISOString()}`,
    "",
    `**${summary.verdict.headline}.** ${summary.verdict.text}`,
    "",
    "## Ami jó",
    "",
    ...(summary.good.length
      ? summary.good.map((item) => `- ${item}`)
      : ["- Még nincs sikeres teljes futás."]),
    "",
    "## Ami nem jó",
    "",
    ...(summary.bad.length
      ? summary.bad.map((item) => `- ${item}`)
      : ["- Nincs ismert hiba a lefuttatott csomagokban."]),
    "",
    "## A versenykiírás fejezetei",
    "",
    "| Fejezet | Cím | Sikeres | Sikertelen |",
    "| - | - | - | - |",
    ...summary.spec.map(
      (chapter) =>
        `| ${chapter.chapter}. | ${chapter.title} | ${chapter.passed} | ${chapter.failed} |`,
    ),
    "",
    "## Csomagok",
    "",
    "| Csoport | Csomag | Állapot | Sikeres | Sikertelen |",
    "| - | - | - | - | - |",
    ...summary.groups.flatMap((group) =>
      group.suites.map(
        (state) =>
          `| ${group.group} | ${state.title.replaceAll("|", "\\|")} | ${STATUS_TEXT[state.status]} | ${state.counts?.passed ?? "–"} | ${state.counts?.failed ?? "–"} |`,
      ),
    ),
    "",
    "## Teendők",
    "",
    ...summary.recommendations.map((item) => `- ${item}`),
    "",
  ];
  return lines.join("\n");
}
