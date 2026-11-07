import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { Button } from "react-aria-components";
import { api, type Summary, startMany } from "./api.ts";
import {
  CountTriplet,
  Empty,
  Panel,
  SeverityTag,
  StatusPill,
  toast,
  useCopy,
} from "./components.tsx";
import { Check, Copy, Cross, Download, Play, Warn } from "./icons.tsx";
import { formatDuration, formatTime, href, SEVERITIES, useLive } from "./state.ts";

const LEVEL_TEXT = { green: "ZÖLD", amber: "SÁRGA", red: "PIROS" } as const;

export function SummaryPage() {
  const runs = useLive((state) => state.runs);
  const findings = useLive((state) => state.findings);
  const copy = useCopy();
  const query = useQuery({ queryKey: ["summary"], queryFn: () => api<Summary>("/api/summary") });
  const finished = [...runs.values()].filter(
    (run) => !["queued", "running"].includes(run.status),
  ).length;
  useEffect(() => {
    void query.refetch();
  }, [finished, findings.length]);
  if (query.isPending)
    return (
      <p className="muted page" role="status">
        Összegzés készül…
      </p>
    );
  if (query.isError)
    return <Empty title="Az összegzés nem készült el">{(query.error as Error).message}</Empty>;
  const summary = query.data;
  const specTotal = summary.spec.reduce((sum, chapter) => sum + chapter.passed + chapter.failed, 0);
  const runSpec = async () => {
    try {
      const { runs: created } = await startMany({
        group: "Versenykiírás (PDF)",
        includeLong: true,
      });
      toast(`${created.length} kiírás-csomag sorba állítva.`, "ok");
    } catch (error) {
      toast((error as Error).message, "fail");
    }
  };
  return (
    <div className="page summary">
      <section
        className={`verdict verdict-${summary.verdict.level}`}
        aria-labelledby="verdict-title"
      >
        <div className="verdict-lamp" aria-hidden="true">
          {summary.verdict.level === "green" ? (
            <Check size={30} />
          ) : summary.verdict.level === "amber" ? (
            <Warn size={30} />
          ) : (
            <Cross size={30} />
          )}
        </div>
        <div>
          <p className="eyebrow">
            Összegzés · {formatTime(summary.generatedAt)} · {LEVEL_TEXT[summary.verdict.level]}
          </p>
          <h1 id="verdict-title">{summary.verdict.headline}</h1>
          <p>{summary.verdict.text}</p>
        </div>
        <div className="hero-actions">
          <Button
            className="button"
            onPress={() =>
              void api<string>("/api/summary.md").then((text) =>
                copy(text, "Az összegzés Markdownként a vágólapon."),
              )
            }
          >
            <Copy /> Másolás
          </Button>
          <a className="button" href="/api/summary.md" download="tesztosszegzes.md">
            <Download /> Markdown
          </a>
        </div>
      </section>

      <div className="kpis">
        <div className={`kpi ${summary.totals.red ? "kpi-fail" : "kpi-ok"}`}>
          <span className="kpi-label">Zöld csomag</span>
          <span className="kpi-value">
            {summary.totals.green}/{summary.totals.suites}
          </span>
          <span className="kpi-detail">
            {summary.totals.red} piros · {summary.totals.never} még nem futott
          </span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Eset a legutóbbi futásokban</span>
          <span className="kpi-value">
            {summary.totals.passedCases + summary.totals.failedCases}
          </span>
          <span className="kpi-detail">
            {summary.totals.passedCases} sikeres · {summary.totals.failedCases} sikertelen
          </span>
        </div>
        <div
          className={`kpi ${summary.totals.openFindings.blokkoló ? "kpi-fail" : summary.totals.openFindings.magas ? "kpi-warn" : "kpi-ok"}`}
        >
          <span className="kpi-label">Nyitott találat</span>
          <span className="kpi-value">
            {SEVERITIES.reduce((sum, severity) => sum + summary.totals.openFindings[severity], 0)}
          </span>
          <span className="kpi-detail">
            {SEVERITIES.map(
              (severity) => `${summary.totals.openFindings[severity]} ${severity}`,
            ).join(" · ")}
          </span>
        </div>
        <div className={`kpi ${summary.totals.flaky ? "kpi-warn" : ""}`}>
          <span className="kpi-label">Instabil teszt</span>
          <span className="kpi-value">{summary.totals.flaky}</span>
          <span className="kpi-detail">hol sikeres, hol nem</span>
        </div>
      </div>

      <div className="two">
        <Panel title="Ami jó" className="good-panel" actions={<Check />}>
          {summary.good.length ? (
            <ul className="verdict-list">
              {summary.good.map((item) => (
                <li key={item}>
                  <span className="mark-ok" aria-hidden="true">
                    ✓
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          ) : (
            <Empty title="Még nincs sikeres teljes futás" />
          )}
        </Panel>
        <Panel title="Ami nem jó" className="bad-panel" actions={<Cross />}>
          {summary.bad.length ? (
            <ul className="verdict-list">
              {summary.bad.map((item) => (
                <li key={item}>
                  <span className="mark-bad" aria-hidden="true">
                    ✗
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          ) : (
            <Empty title="Nincs ismert hiba">A lefuttatott csomagokban minden eset sikeres.</Empty>
          )}
        </Panel>
      </div>

      <Panel title="Teendők, fontossági sorrendben" id="todo">
        <ol className="todo-list">
          {summary.recommendations.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      </Panel>

      <Panel
        title="A versenykiírás fejezetei"
        id="spec"
        actions={
          <Button className="button ghost small" onPress={() => void runSpec()}>
            <Play size={14} /> Kiírás-csomagok futtatása
          </Button>
        }
      >
        {specTotal === 0 ? (
          <Empty title="Még nincs kiírás-eredmény">
            Futtasd a „Versenykiírás (PDF)” csoportot.
          </Empty>
        ) : null}
        <table className="spec-table">
          <thead>
            <tr>
              <th scope="col">Fejezet</th>
              <th scope="col">Tartalom</th>
              <th scope="col">Állapot</th>
              <th scope="col">Szabály</th>
            </tr>
          </thead>
          <tbody>
            {summary.spec.map((chapter) => {
              const total = chapter.passed + chapter.failed;
              return (
                <tr
                  key={chapter.chapter}
                  className={chapter.failed ? "spec-bad" : total ? "spec-ok" : "spec-none"}
                >
                  <th scope="row" className="mono">
                    {chapter.chapter}.
                  </th>
                  <td>
                    {chapter.title}
                    {chapter.failures.map((failure) => (
                      <p key={failure} className="error-text small">
                        {failure}
                      </p>
                    ))}
                  </td>
                  <td>
                    {total === 0 ? (
                      <span className="muted">nincs adat</span>
                    ) : chapter.failed ? (
                      <span className="error-text">✗ {chapter.failed} sérül</span>
                    ) : (
                      <span className="ok-text">✓ teljesül</span>
                    )}
                  </td>
                  <td>
                    <div
                      className="spec-bar"
                      role="img"
                      aria-label={`${chapter.passed} sikeres, ${chapter.failed} sikertelen`}
                    >
                      <i
                        className="bar-ok"
                        style={{ width: `${total ? (chapter.passed / total) * 100 : 0}%` }}
                      />
                      <i
                        className="bar-bad"
                        style={{ width: `${total ? (chapter.failed / total) * 100 : 0}%` }}
                      />
                    </div>
                    <span className="mono small">
                      {chapter.passed}/{total}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Panel>

      <Panel title="Csomagok csoportonként" id="groups">
        <div className="group-grid">
          {summary.groups.map((group) => (
            <div key={group.group} className="group-card">
              <h3>{group.group}</h3>
              <ul className="list">
                {group.suites.map((suite) => (
                  <li key={suite.id} className="group-suite">
                    <a
                      href={href({ page: "suites", suite: suite.id })}
                      className="group-suite-link"
                    >
                      {suite.status === "never" ? (
                        <span className="pill pill-none">nem futott</span>
                      ) : (
                        <StatusPill status={suite.status} compact />
                      )}
                      <span className="list-title">{suite.title}</span>
                      {suite.counts ? <CountTriplet {...suite.counts} /> : null}
                    </a>
                    {suite.failures.slice(0, 2).map((failure) => (
                      <p key={failure.name} className="error-text small group-failure">
                        {failure.name}
                        {failure.location ? (
                          <span className="mono"> · {failure.location}</span>
                        ) : null}
                      </p>
                    ))}
                    {suite.durationMs ? (
                      <span className="muted small">{formatDuration(suite.durationMs)}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Panel>

      <div className="two">
        <Panel title="Felelősök" id="owners">
          {summary.owners.length ? (
            <ul className="list">
              {summary.owners.map((owner) => (
                <li key={owner.owner} className="owner-row">
                  <strong>{owner.owner}</strong>
                  <span>{owner.open} nyitott</span>
                  {owner.blocking ? <SeverityTag severity="magas" /> : null}
                  {owner.blocking ? (
                    <span className="error-text small">{owner.blocking} komoly</span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <Empty title="Senkire nem vár nyitott találat" />
          )}
        </Panel>
        <Panel title="Lefedettség" id="coverage">
          <ul className="list">
            {summary.coverage.map((item) => (
              <li key={item.suite} className="coverage-row">
                <span className="list-title">{item.suite}</span>
                {item.average === null ? (
                  <span className="muted small">még nem futott</span>
                ) : (
                  <>
                    <span className="mono">{item.average}% átlag</span>
                    <span className={item.below ? "error-text small" : "ok-text small"}>
                      {item.below ? `${item.below} fájl 95% alatt` : "minden fájl 95% felett"}
                    </span>
                    {item.worst.slice(0, 3).map((file) => (
                      <span key={file.file} className="muted small mono">
                        {file.percent}% · {file.file}
                      </span>
                    ))}
                  </>
                )}
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      {summary.flaky.length ? (
        <Panel title="Instabil tesztek" id="flaky">
          <ul className="list">
            {summary.flaky.map((item) => (
              <li key={`${item.suiteId}${item.title}`} className="owner-row">
                <span className="mono small">{item.history}</span>
                <span className="list-title">{item.title}</span>
                <span className="muted small">{item.suiteId}</span>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      {summary.neverRun.length ? (
        <Panel title="Még nem futott (nem bizonyított)" id="never">
          <p className="muted small">{summary.neverRun.join(" · ")}</p>
        </Panel>
      ) : null}
    </div>
  );
}
