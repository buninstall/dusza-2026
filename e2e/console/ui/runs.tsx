import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  Input,
  SearchField,
  Switch,
  Tab,
  TabList,
  TabPanel,
  Tabs,
} from "react-aria-components";
import { api, type RunDetail, type RunSummary, startRuns, type TestCase } from "./api.ts";
import {
  CountTriplet,
  Empty,
  Highlight,
  Hint,
  RunProgress,
  StatusPill,
  toast,
  useCopy,
  useDebounced,
} from "./components.tsx";
import { Copy, Download, Play, Repeat, Search, Split, Stop } from "./icons.tsx";
import { formatDuration, formatTime, href, navigate, runsOf, useLive } from "./state.ts";

const ERROR_LINE =
  /(✗|✘|\bFAILED\b|\berror\b|\(fail\)|panicked|Error:|AssertionError|Expected|Received|timed out|Timeout)/i;

function rerunTarget(run: RunSummary | RunDetail, item: TestCase) {
  const suite = useLive.getState().suites.find((candidate) => candidate.id === run.suiteId);
  if (!suite || suite.targets === "none") return null;
  if (suite.targets === "cargo") return { name: item.name };
  if (suite.targets === "playwright")
    return item.file ? { file: item.file, ...(item.line ? { line: item.line } : {}) } : null;
  return { ...(item.file ? { file: item.file } : {}), name: item.name };
}

function CaseCard({ run, item, needle }: { run: RunDetail; item: TestCase; needle: string }) {
  const copy = useCopy();
  const location = item.file ? `${item.file}${item.line ? `:${item.line}` : ""}` : null;
  const target = rerunTarget(run, item);
  return (
    <li className={`case case-${item.status}`}>
      <details open={item.status === "failed" && run.counts.failed <= 8}>
        <summary>
          <span className={`case-mark mark-${item.status}`} aria-hidden="true" />
          <span className="sr-only">
            {item.status === "failed"
              ? "sikertelen"
              : item.status === "passed"
                ? "sikeres"
                : "kihagyott"}
            :{" "}
          </span>
          <span className="case-name">
            <Highlight text={item.name} needle={needle} />
          </span>
          {item.severity ? <span className="chip">{item.severity}</span> : null}
          {item.durationMs !== null ? (
            <span className="muted mono small">{formatDuration(item.durationMs)}</span>
          ) : null}
        </summary>
        <div className="case-body">
          {location ? (
            <p className="mono small">
              <span className="muted">hely </span>
              {location}
            </p>
          ) : null}
          {item.message ? <p className="case-message">{item.message}</p> : null}
          {item.details ? <pre className="code-block">{item.details}</pre> : null}
          <div className="row-actions">
            {item.status === "failed" && target ? (
              <Button
                className="button ghost small"
                onPress={() =>
                  void startRuns(run.suiteId, { target }).then(
                    ({ runs }) => runs[0] && navigate({ page: "runs", run: runs[0].id }),
                  )
                }
              >
                <Play size={14} /> Csak ezt újra
              </Button>
            ) : null}
            <Button
              className="button ghost small"
              onPress={() =>
                void copy(
                  [item.name, location, item.message, item.details].filter(Boolean).join("\n\n"),
                  "Az eset részletei a vágólapon.",
                )
              }
            >
              <Copy size={14} /> Másolás
            </Button>
          </div>
        </div>
      </details>
    </li>
  );
}

function LogViewer({ run }: { run: RunDetail }) {
  const [lines, setLines] = useState<string[]>(run.tail);
  const [needle, setNeedle] = useState("");
  const [follow, setFollow] = useState(true);
  const [onlyErrors, setOnlyErrors] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const cursor = useRef(-1);
  const debounced = useDebounced(needle, 150);
  useEffect(() => setLines(run.tail), [run.tail]);
  useEffect(() => {
    const listener = (runId: string, added: string[]) => {
      if (runId === run.id) setLines((current) => [...current, ...added].slice(-5000));
    };
    const listeners = useLive.getState().logListeners;
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, [run.id]);
  const shown = useMemo(
    () =>
      lines
        .map((text, index) => ({ text, index }))
        .filter(
          (line) =>
            (!onlyErrors || ERROR_LINE.test(line.text)) &&
            (!debounced || line.text.toLowerCase().includes(debounced.toLowerCase())),
        ),
    [lines, debounced, onlyErrors],
  );
  useEffect(() => {
    if (follow && box.current) box.current.scrollTop = box.current.scrollHeight;
  }, [shown, follow]);
  const jump = () => {
    const errors = box.current?.querySelectorAll<HTMLElement>(".log-error");
    if (!errors || errors.length === 0) return toast("Nincs hibasor a naplóban.");
    setFollow(false);
    cursor.current = (cursor.current + 1) % errors.length;
    errors[cursor.current]?.scrollIntoView({ block: "center" });
  };
  return (
    <div className="log">
      <div className="toolbar">
        <SearchField
          className="search"
          value={needle}
          onChange={setNeedle}
          aria-label="Keresés a naplóban"
        >
          <Search />
          <Input className="input" placeholder="Keresés a naplóban…" />
        </SearchField>
        <Switch className="switch" isSelected={onlyErrors} onChange={setOnlyErrors}>
          <span className="switch-track" aria-hidden="true" />
          Csak hibasorok
        </Switch>
        <Switch className="switch" isSelected={follow} onChange={setFollow}>
          <span className="switch-track" aria-hidden="true" />
          Követés
        </Switch>
        <Button className="button ghost small" onPress={jump}>
          Következő hiba ↓
        </Button>
        <a
          className="button ghost small"
          href={`/api/runs/${run.id}/log`}
          download={`futas-${run.id}.log`}
        >
          <Download size={14} /> Teljes napló
        </a>
      </div>
      <div className="log-box" ref={box} role="log" aria-label="Futási napló">
        {shown.map((line) => (
          <div
            key={line.index}
            className={ERROR_LINE.test(line.text) ? "log-line log-error" : "log-line"}
          >
            <span className="log-no" aria-hidden="true">
              {line.index + 1}
            </span>
            <span className="log-text">
              <Highlight text={line.text} needle={debounced} />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RunDetailView({ runId }: { runId: string }) {
  const live = useLive((state) => state.runs.get(runId));
  const runs = useLive((state) => state.runs);
  const client = useQueryClient();
  const [needle, setNeedle] = useState("");
  const debounced = useDebounced(needle, 150);
  const status = live?.status;
  const query = useQuery({
    queryKey: ["run", runId, status],
    queryFn: () => api<RunDetail>(`/api/runs/${runId}`),
  });
  useEffect(() => {
    void client.invalidateQueries({ queryKey: ["run", runId] });
  }, [client, runId]);
  if (query.isPending)
    return (
      <p className="muted" role="status">
        Futás betöltése…
      </p>
    );
  if (query.isError)
    return <Empty title="A futás nem tölthető be">{(query.error as Error).message}</Empty>;
  const run = { ...query.data, ...(live ?? {}) } as RunDetail;
  const cases = query.data.cases;
  const filter = (kind: string) =>
    cases.filter(
      (item) =>
        (kind === "all" || item.status === kind) &&
        (!debounced ||
          `${item.name} ${item.message ?? ""} ${item.file ?? ""}`
            .toLowerCase()
            .includes(debounced.toLowerCase())),
    );
  const previous = runsOf(runs, run.suiteId)
    .filter(
      (other) =>
        other.id !== run.id &&
        other.queuedAt < run.queuedAt &&
        ["passed", "failed"].includes(other.status),
    )
    .at(-1);
  const failed = cases.filter((item) => item.status === "failed");
  const rerunFailed = async () => {
    const targets = failed
      .map((item) => rerunTarget(run, item))
      .filter((target) => target !== null);
    if (targets.length === 0)
      return toast("Ennél a csomagnál nincs egyenkénti újrafuttatás; az egész csomag fut újra.");
    for (const target of targets.slice(0, 30)) await startRuns(run.suiteId, { target });
    toast(`${Math.min(targets.length, 30)} sikertelen eset sorba állítva.`, "ok");
  };
  return (
    <div className="detail">
      <div className="detail-head">
        <div>
          <p className="eyebrow">
            {run.suiteId}
            {run.label ? ` · ${run.label}` : ""}
          </p>
          <h2>{run.title}</h2>
        </div>
        <StatusPill status={run.status} />
      </div>
      {run.status === "running" ? <RunProgress run={run} /> : null}
      <dl className="facts">
        <dt>Parancs</dt>
        <dd className="mono small">{run.command || "beépített vizsgálat"}</dd>
        <dt>Időpont</dt>
        <dd>
          {formatTime(run.startedAt ?? run.queuedAt)} ·{" "}
          {formatDuration(run.startedAt ? (run.finishedAt ?? Date.now()) - run.startedAt : null)}
        </dd>
        <dt>Eredmény</dt>
        <dd>
          <CountTriplet {...run.counts} />
          {run.exitCode !== null ? (
            <span className="muted"> · kilépési kód {run.exitCode}</span>
          ) : null}
        </dd>
        {run.summary ? (
          <>
            <dt>Összegzés</dt>
            <dd>{run.summary}</dd>
          </>
        ) : null}
      </dl>
      <div className="toolbar">
        {run.status === "running" || run.status === "queued" ? (
          <Button
            className="button danger"
            onPress={() =>
              void api(`/api/runs/${run.id}/cancel`, { method: "POST", body: {} }).catch(
                (error: Error) => toast(error.message, "fail"),
              )
            }
          >
            <Stop /> Leállítás
          </Button>
        ) : null}
        <Button
          className="button"
          onPress={() =>
            void startRuns(run.suiteId, run.target ? { target: run.target } : {}).then(
              ({ runs: created }) => created[0] && navigate({ page: "runs", run: created[0].id }),
            )
          }
        >
          <Repeat /> Újrafuttatás
        </Button>
        {failed.length ? (
          <Button className="button" onPress={() => void rerunFailed()}>
            <Play /> Sikertelenek újra ({failed.length})
          </Button>
        ) : null}
        {previous ? (
          <Hint label="Mi romlott el, mi javult az előző teljes futáshoz képest">
            <Button
              className="button ghost"
              onPress={() => navigate({ page: "compare", a: previous.id, b: run.id })}
            >
              <Split /> Összevetés az előzővel
            </Button>
          </Hint>
        ) : null}
      </div>
      <Tabs
        className="tabs"
        defaultSelectedKey={failed.length ? "failed" : cases.length ? "all" : "log"}
      >
        <TabList className="tab-list" aria-label="A futás nézetei">
          <Tab id="failed" className="tab">
            Sikertelen ({failed.length})
          </Tab>
          <Tab id="passed" className="tab">
            Sikeres ({run.counts.passed})
          </Tab>
          <Tab id="skipped" className="tab">
            Kihagyott ({run.counts.skipped})
          </Tab>
          <Tab id="all" className="tab">
            Mind ({cases.length})
          </Tab>
          <Tab id="log" className="tab">
            Napló
          </Tab>
        </TabList>
        {["failed", "passed", "skipped", "all"].map((kind) => {
          const list = filter(kind);
          return (
            <TabPanel key={kind} id={kind} className="tab-panel">
              <SearchField
                className="search"
                value={needle}
                onChange={setNeedle}
                aria-label="Esetek szűrése"
              >
                <Search />
                <Input
                  className="input"
                  placeholder="Esetek szűrése név, üzenet vagy fájl szerint…"
                />
              </SearchField>
              {list.length ? (
                <ul className="cases">
                  {list.slice(0, 400).map((item) => (
                    <CaseCard
                      key={`${item.key}:${item.status}`}
                      run={run}
                      item={item}
                      needle={debounced}
                    />
                  ))}
                  {list.length > 400 ? (
                    <li className="muted small">…és még {list.length - 400} eset.</li>
                  ) : null}
                </ul>
              ) : (
                <Empty
                  title={
                    run.status === "running" || run.status === "queued"
                      ? "A futás még nem ért véget"
                      : "Nincs ilyen eset"
                  }
                />
              )}
            </TabPanel>
          );
        })}
        <TabPanel id="log" className="tab-panel">
          <LogViewer run={query.data} />
        </TabPanel>
      </Tabs>
    </div>
  );
}

export function Runs({ runId }: { runId?: string | undefined }) {
  const runs = useLive((state) => state.runs);
  const [needle, setNeedle] = useState("");
  const [status, setStatus] = useState<string>("all");
  const sorted = [...runs.values()]
    .filter(
      (run) =>
        (status === "all" || run.status === status) &&
        run.title.toLowerCase().includes(needle.toLowerCase()),
    )
    .sort((a, b) => b.queuedAt - a.queuedAt);
  const selected = runId ?? sorted[0]?.id;
  return (
    <div className="page split-page">
      <aside className="side-list" aria-label="Futások">
        <div className="side-head">
          <h1>Futások</h1>
          <SearchField
            className="search"
            value={needle}
            onChange={setNeedle}
            aria-label="Futások szűrése"
          >
            <Search />
            <Input className="input" placeholder="Szűrés…" />
          </SearchField>
          <fieldset className="segmented">
            <legend className="sr-only">Állapot szerinti szűrés</legend>
            {[
              ["all", "mind"],
              ["failed", "piros"],
              ["running", "fut"],
              ["passed", "zöld"],
            ].map(([value, label]) => (
              <Button
                key={value}
                className={`segment${status === value ? " active" : ""}`}
                aria-pressed={status === value}
                onPress={() => setStatus(value ?? "all")}
              >
                {label}
              </Button>
            ))}
          </fieldset>
        </div>
        {sorted.length ? (
          <ol className="side-items">
            {sorted.slice(0, 300).map((run) => (
              <li key={run.id}>
                <a
                  className={`side-item${run.id === selected ? " active" : ""}`}
                  href={href({ page: "runs", run: run.id })}
                  aria-current={run.id === selected ? "page" : undefined}
                >
                  <StatusPill status={run.status} compact />
                  <span className="side-title">{run.title}</span>
                  <span className="muted small">
                    {formatTime(run.queuedAt)}
                    {run.label ? ` · ${run.label}` : ""}
                  </span>
                  {["passed", "failed"].includes(run.status) ? (
                    <CountTriplet {...run.counts} />
                  ) : null}
                </a>
              </li>
            ))}
          </ol>
        ) : (
          <Empty title="Még nincs futás" />
        )}
      </aside>
      <section className="main-pane" aria-label="A kiválasztott futás">
        {selected ? (
          <RunDetailView key={selected} runId={selected} />
        ) : (
          <Empty title="Válassz egy futást" />
        )}
      </section>
    </div>
  );
}
