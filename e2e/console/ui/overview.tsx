import { Button } from "react-aria-components";
import { startMany } from "./api.ts";
import {
  CountTriplet,
  Empty,
  Hint,
  Panel,
  RunProgress,
  SeverityTag,
  STATUS_TEXT,
  StatusPill,
  toast,
} from "./components.tsx";
import { Bolt, Nugget, Play, Wave } from "./icons.tsx";
import {
  formatTime,
  href,
  navigate,
  OPEN_STATUSES,
  relative,
  runsOf,
  SEVERITIES,
  useLive,
  useNow,
} from "./state.ts";

const MATRIX_COLUMNS = 24;

function Kpi({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string | number;
  detail?: string;
  tone?: string | undefined;
}) {
  return (
    <div className={`kpi${tone ? ` kpi-${tone}` : ""}`}>
      <span className="kpi-label">{label}</span>
      <span className="kpi-value">{value}</span>
      {detail ? <span className="kpi-detail">{detail}</span> : null}
    </div>
  );
}

export function Overview() {
  const { suites, runs, findings } = useLive();
  const now = useNow(15_000);
  const all = [...runs.values()];
  const open = findings.filter((finding) => OPEN_STATUSES.has(finding.status));
  const flaky = findings.filter((finding) => finding.flaky && finding.status !== "hamis riasztás");
  const active = all.filter((run) => run.status === "running");
  const queued = all.filter((run) => run.status === "queued");
  const latest = suites
    .map((suite) => runsOf(runs, suite.id).at(-1))
    .filter((run) => run !== undefined);
  const green = latest.filter((run) => run.status === "passed").length;
  const red = latest.filter((run) => run.status === "failed" || run.status === "error").length;
  const never = suites.length - latest.length;
  const executed = latest.reduce((sum, run) => sum + run.counts.passed + run.counts.failed, 0);
  const passedCases = latest.reduce((sum, run) => sum + run.counts.passed, 0);
  const regressions = findings
    .filter(
      (finding) =>
        finding.status === "új" &&
        finding.history.length >= 2 &&
        finding.history.at(-2) === "passed",
    )
    .slice(0, 8);
  const run = async (includeLong: boolean) => {
    try {
      const { runs: created } = await startMany({ includeLong });
      toast(`${created.length} csomag sorba állítva.`, "ok");
    } catch (error) {
      toast(String((error as Error).message), "fail");
    }
  };

  return (
    <div className="page overview">
      <div className="hero">
        <div>
          <p className="eyebrow">Aknajelentés · {formatTime(now)}</p>
          <h1 className="hero-title">
            {active.length
              ? "Fúrás folyamatban"
              : red
                ? `${red} csomag piros`
                : never === suites.length
                  ? "Még nem futott semmi"
                  : never
                    ? `${green} zöld, ${never} még nem futott`
                    : "Minden csomag zöld"}
          </h1>
          <p className="muted">
            Ami nem futott le, az nem számít sikeresnek. Minden hiba fájllal, sorral és teljes
            kimenettel kerül a találatok közé.
          </p>
        </div>
        <div className="hero-actions">
          <Button className="button primary large" onPress={() => run(false)}>
            <Bolt /> Gyors csomagok
          </Button>
          <Button className="button large" onPress={() => run(true)}>
            <Play /> Mindent, hosszúakkal
          </Button>
        </div>
      </div>

      <div className="kpis">
        <Kpi
          label="Nyitott találat"
          value={open.length}
          detail={SEVERITIES.map(
            (severity) =>
              `${open.filter((finding) => finding.severity === severity).length} ${severity}`,
          ).join(" · ")}
          tone={
            open.some((finding) => finding.severity === "blokkoló")
              ? "fail"
              : open.length
                ? "warn"
                : "ok"
          }
        />
        <Kpi
          label="Zöld csomag"
          value={`${green}/${suites.length}`}
          detail={never ? `${never} még nem futott` : "mind lefutott"}
          tone={red ? "fail" : green === suites.length ? "ok" : undefined}
        />
        <Kpi
          label="Sikeres eset"
          value={executed ? `${((passedCases / executed) * 100).toFixed(1)}%` : "–"}
          detail={`${passedCases} / ${executed} eset a legutóbbi futásokban`}
        />
        <Kpi
          label="Instabil teszt"
          value={flaky.length}
          detail="hol sikeres, hol nem"
          tone={flaky.length ? "warn" : undefined}
        />
        <Kpi
          label="Fut / sorban"
          value={`${active.length} / ${queued.length}`}
          detail={active[0]?.title ?? "tétlen"}
          tone={active.length ? "run" : undefined}
        />
      </div>

      {active.length ? (
        <Panel title="Most fut" id="now-running">
          {active.map((item) => (
            <a key={item.id} className="running-card" href={href({ page: "runs", run: item.id })}>
              <div className="running-head">
                <StatusPill status={item.status} />
                <strong>{item.title}</strong>
                {item.label ? <span className="muted">{item.label}</span> : null}
              </div>
              <RunProgress run={item} />
            </a>
          ))}
        </Panel>
      ) : null}

      <Panel
        title="Egészségmátrix"
        id="matrix"
        actions={
          <span className="muted small">
            csomagonként az utolsó {MATRIX_COLUMNS} teljes futás, a legújabb jobbra
          </span>
        }
      >
        <ul className="matrix" aria-label="Csomagok futási előzménye">
          {suites.map((suite) => {
            const history = runsOf(runs, suite.id).slice(-MATRIX_COLUMNS);
            const last = history.at(-1);
            return (
              <li className="matrix-row" key={suite.id}>
                <a className="matrix-name" href={href({ page: "suites", suite: suite.id })}>
                  <span className="matrix-group">{suite.group}</span>
                  {suite.title}
                </a>
                <div className="matrix-cells">
                  {Array.from({ length: MATRIX_COLUMNS - history.length }, (_, index) => (
                    <span key={`e${index}`} className="cell cell-empty" aria-hidden="true" />
                  ))}
                  {history.map((item) => (
                    <Hint
                      key={item.id}
                      label={`${STATUS_TEXT[item.status]} · ${formatTime(item.startedAt ?? item.queuedAt)} · ${item.counts.passed}✓ ${item.counts.failed}✗`}
                    >
                      <Button
                        className={`cell cell-${item.status}`}
                        aria-label={`${suite.title}: ${STATUS_TEXT[item.status]}, ${formatTime(item.queuedAt)}`}
                        onPress={() => navigate({ page: "runs", run: item.id })}
                      />
                    </Hint>
                  ))}
                </div>
                <span className="matrix-last">
                  {last ? <CountTriplet {...last.counts} /> : <span className="muted">–</span>}
                  <span className="muted small">
                    {relative(last?.finishedAt ?? last?.queuedAt, now)}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      </Panel>

      <div className="two">
        <Panel title="Friss regressziók" id="regressions" actions={<Wave />}>
          {regressions.length ? (
            <ul className="list">
              {regressions.map((finding) => (
                <li key={finding.id}>
                  <a href={href({ page: "findings", finding: finding.id })} className="list-link">
                    <SeverityTag severity={finding.severity} />
                    <span className="list-title">{finding.title}</span>
                    <span className="muted small">{finding.suiteId} · korábban sikeres volt</span>
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <Empty title="Nincs regresszió">Egyik korábban sikeres eset sem romlott el.</Empty>
          )}
        </Panel>
        <Panel title="Legsúlyosabb nyitott találatok" id="top-findings" actions={<Nugget />}>
          {open.length ? (
            <ul className="list">
              {[...open]
                .sort(
                  (a, b) =>
                    SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity) ||
                    b.lastSeen - a.lastSeen,
                )
                .slice(0, 8)
                .map((finding) => (
                  <li key={finding.id}>
                    <a href={href({ page: "findings", finding: finding.id })} className="list-link">
                      <SeverityTag severity={finding.severity} />
                      <span className="list-title">{finding.title}</span>
                      <span className="muted small">
                        {finding.owner} · {finding.occurrences}× {finding.flaky ? "· instabil" : ""}
                      </span>
                    </a>
                  </li>
                ))}
            </ul>
          ) : (
            <Empty title="Nincs nyitott találat">
              Futtass csomagokat, hogy a hibák felszínre kerüljenek.
            </Empty>
          )}
        </Panel>
      </div>
    </div>
  );
}
