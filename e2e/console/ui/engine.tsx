import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  Input,
  Label,
  SearchField,
  Slider,
  SliderOutput,
  SliderThumb,
  SliderTrack,
  Switch,
  Tab,
  TabList,
  TabPanel,
  Tabs,
  TextArea,
  TextField,
} from "react-aria-components";
import { api, type EngineCaseLite, type LiveCase, type RunSummary, type Trace } from "./api.ts";
import {
  CountTriplet,
  Empty,
  Highlight,
  Panel,
  RunProgress,
  StatusPill,
  toast,
  useDebounced,
} from "./components.tsx";
import { Bolt, Check, Cross, Play, Repeat, Search, Square, Stop } from "./icons.tsx";
import { formatDuration, formatTime, navigate, useLive, useNow } from "./state.ts";

type Event = NonNullable<Trace["wasm"]>["events"][number];
type Cell = "empty" | "wall" | "gold";

const DIR_ARROW: Record<string, string> = { east: "▶", west: "◀", north: "▲", south: "▼" };
const DIR_TEXT: Record<string, string> = {
  east: "kelet",
  west: "nyugat",
  north: "észak",
  south: "dél",
};

function valueText(value: { kind: string; value: number | boolean }): string {
  return String(value.value);
}

type Frame = {
  robot: { row: number; col: number; dir: string };
  discovered: Set<string>;
  mined: Set<string>;
  gold: number;
  steps: number;
  console: string[];
  variables: Map<string, string>;
  line: number | null;
  heat: Map<number, number>;
  event: Event | null;
};

function frameAt(trace: Trace, events: Event[], index: number): Frame | null {
  const map = trace.map;
  if (!map) return null;
  const discovered = new Set([`${map.robot.row},${map.robot.col}`]);
  const mined = new Set<string>();
  const variables = new Map<string, string>();
  const heat = new Map<number, number>();
  const output: string[] = [];
  let robot = { row: map.robot.row, col: map.robot.col, dir: map.dir as string };
  let last: Event | null = null;
  for (const event of events.slice(0, index)) {
    for (const cell of event.discovered) discovered.add(`${cell.row},${cell.col}`);
    if (event.mined) mined.add(`${event.mined.row},${event.mined.col}`);
    if (event.assigned) variables.set(event.assigned.name, valueText(event.assigned.value));
    if (event.print !== null) output.push(event.print);
    heat.set(event.line, (heat.get(event.line) ?? 0) + 1);
    robot = { row: event.robot.pos.row, col: event.robot.pos.col, dir: event.robot.dir };
    last = event;
  }
  return {
    robot,
    discovered,
    mined,
    gold: last?.gold ?? 0,
    steps: last?.steps ?? 0,
    console: output,
    variables,
    line: last?.line ?? null,
    heat,
    event: last,
  };
}

function narrate(event: Event | null, lines: string[]): string {
  if (!event) return "Alaphelyzet: a robot a kezdőmezőn áll, még egy sor sem futott.";
  const code = (lines[event.line - 1] ?? "").trim();
  const parts = [`${event.steps}. lépés · ${event.line}. sor: ${code}`];
  if (event.path.length)
    parts.push(
      `a robot ${event.path.length} mezőt lépett, most (${event.robot.pos.row + 1}. sor, ${event.robot.pos.col + 1}. oszlop)`,
    );
  if (event.mined) parts.push(`aranyrögöt bányászott (összesen ${event.gold})`);
  if (event.assigned) parts.push(`${event.assigned.name} = ${valueText(event.assigned.value)}`);
  if (event.print !== null) parts.push(`kiírta: ${event.print}`);
  if (event.discovered.length && !event.path.length)
    parts.push(`felfedezett ${event.discovered.length} mezőt`);
  return parts.join(" → ");
}

function MineGrid({ trace, frame }: { trace: Trace; frame: Frame }) {
  const map = trace.map;
  if (!map) return null;
  return (
    <div
      className="sim-grid"
      style={{
        gridTemplateColumns: `repeat(${map.cols}, minmax(0, 1fr))`,
        aspectRatio: `${map.cols} / ${map.rows}`,
      }}
      role="img"
      aria-label={`Térkép: ${map.rows}×${map.cols}, a robot a(z) ${frame.robot.row + 1}. sor ${frame.robot.col + 1}. oszlopában ${DIR_TEXT[frame.robot.dir] ?? ""} felé néz, ${frame.discovered.size} felfedezett mező`}
    >
      {map.cells.flatMap((row, r) =>
        row.map((cell: Cell, c) => {
          const key = `${r},${c}`;
          const seen = frame.discovered.has(key);
          const robot = frame.robot.row === r && frame.robot.col === c;
          const kind = frame.mined.has(key) ? "empty" : cell;
          return (
            <span
              key={key}
              className={`sim-cell sim-${kind}${seen ? " seen" : " fog"}${robot ? " here" : ""}`}
            >
              {robot ? (
                <b className="sim-robot">{DIR_ARROW[frame.robot.dir]}</b>
              ) : kind === "gold" ? (
                "◆"
              ) : null}
            </span>
          );
        }),
      )}
    </div>
  );
}

function CodeView({
  program,
  frame,
  errorLine,
  badLines,
}: {
  program: string;
  frame: Frame | null;
  errorLine: number | null;
  badLines: number[];
}) {
  const lines = program.length ? program.replace(/\n$/, "").split("\n") : [];
  const max = Math.max(1, ...(frame ? [...frame.heat.values()] : [1]));
  const box = useRef<HTMLOListElement>(null);
  useEffect(() => {
    box.current?.querySelector(".code-now")?.scrollIntoView({ block: "nearest" });
  }, [frame?.line]);
  if (lines.length === 0) return <p className="muted small">Üres program.</p>;
  return (
    <ol className="sim-code" ref={box} aria-label="Program">
      {lines.slice(0, 1200).map((text, index) => {
        const number = index + 1;
        const heat = frame?.heat.get(number) ?? 0;
        const now = frame?.line === number;
        const bad = badLines.includes(number) || errorLine === number;
        return (
          <li
            key={number}
            className={`${now ? "code-now" : ""}${bad ? " code-bad" : ""}`}
            aria-current={now ? "step" : undefined}
          >
            <span className="code-no">{number}</span>
            <span
              className="code-heat"
              aria-hidden="true"
              style={{ width: `${(heat / max) * 100}%` }}
            />
            <code>{text.replaceAll(" ", " ")}</code>
            {heat ? <span className="code-count">{heat}×</span> : null}
          </li>
        );
      })}
    </ol>
  );
}

function Player({
  trace,
  onFinished,
  autoplaySpeed,
}: {
  trace: Trace;
  onFinished?: () => void;
  autoplaySpeed?: number;
}) {
  const [engine, setEngine] = useState<"wasm" | "reference">("wasm");
  const result = engine === "wasm" ? trace.wasm : trace.reference;
  const events = result?.events ?? [];
  const [index, setIndex] = useState(autoplaySpeed ? 0 : events.length);
  const [playing, setPlaying] = useState(Boolean(autoplaySpeed));
  const [speed, setSpeed] = useState(autoplaySpeed ?? 8);
  const finished = useRef(false);
  useEffect(() => {
    setIndex(autoplaySpeed ? 0 : (result?.events.length ?? 0));
    setPlaying(Boolean(autoplaySpeed));
    finished.current = false;
  }, [trace, autoplaySpeed, result]);
  useEffect(() => {
    if (!playing) return;
    if (index >= events.length) {
      setPlaying(false);
      if (!finished.current) {
        finished.current = true;
        onFinished?.();
      }
      return;
    }
    const jump = Math.max(1, Math.round(speed / 60));
    const timer = setTimeout(
      () => setIndex((value) => Math.min(value + jump, events.length)),
      Math.max(16, 1000 / speed),
    );
    return () => clearTimeout(timer);
  }, [playing, index, events.length, speed, onFinished]);
  const frame = useMemo(() => frameAt(trace, events, index), [trace, events, index]);
  const lines = trace.program.replace(/\n$/, "").split("\n");
  const outcome = result?.outcome;
  const atEnd = index >= events.length;
  const errorLine = atEnd && outcome?.kind === "runtimeError" ? outcome.line : null;
  const badLines = trace.syntax.wasm.map((item) => item.line);
  const divergence = trace.divergence;
  return (
    <div className="sim">
      <div className="sim-controls toolbar">
        <Button
          className="button primary"
          onPress={() => (atEnd ? (setIndex(0), setPlaying(true)) : setPlaying(!playing))}
        >
          {playing ? <Stop /> : <Play />}{" "}
          {playing ? "Megállít" : atEnd ? "Lejátszás az elejéről" : "Folytatás"}
        </Button>
        <Button
          className="button ghost"
          aria-label="Egy lépés vissza"
          onPress={() => {
            setPlaying(false);
            setIndex(Math.max(0, index - 1));
          }}
          isDisabled={index === 0}
        >
          ◀ 1
        </Button>
        <Button
          className="button ghost"
          aria-label="Egy lépés előre"
          onPress={() => {
            setPlaying(false);
            setIndex(Math.min(events.length, index + 1));
          }}
          isDisabled={atEnd}
        >
          1 ▶
        </Button>
        <Slider className="slider" value={speed} onChange={setSpeed} minValue={1} maxValue={240}>
          <Label>Sebesség</Label>
          <SliderOutput className="mono small">
            {({ state }) => `${state.getThumbValue(0)} lépés/mp`}
          </SliderOutput>
          <SliderTrack className="slider-track">
            <SliderThumb className="slider-thumb" />
          </SliderTrack>
        </Slider>
        <div className="segmented" role="radiogroup" aria-label="Melyik motor futását mutassa">
          {(["wasm", "reference"] as const).map((value) => (
            <Button
              key={value}
              className={`segment${engine === value ? " active" : ""}`}
              aria-pressed={engine === value}
              onPress={() => setEngine(value)}
            >
              {value === "wasm" ? "WASM-motor" : "referencia"}
            </Button>
          ))}
        </div>
      </div>
      <Slider
        className="slider scrubber"
        value={index}
        onChange={(value) => {
          setPlaying(false);
          setIndex(value);
        }}
        minValue={0}
        maxValue={Math.max(events.length, 1)}
        aria-label="Esemény a futásban"
      >
        <SliderTrack className="slider-track">
          {divergence !== null ? (
            <span
              className="divergence"
              style={{ left: `${(divergence / Math.max(events.length, 1)) * 100}%` }}
              title="Itt tér el a két motor"
            />
          ) : null}
          <SliderThumb className="slider-thumb" />
        </SliderTrack>
      </Slider>
      <p className="sim-narration" aria-live="polite">
        {narrate(frame?.event ?? null, lines)}
      </p>
      <div className="sim-layout">
        <div className="sim-left">
          <h3 className="sim-h">
            Program{" "}
            {trace.case ? (
              <span className="muted small">· {trace.case.ref ? `[${trace.case.ref}]` : ""}</span>
            ) : null}
          </h3>
          <CodeView
            program={trace.program}
            frame={frame}
            errorLine={errorLine}
            badLines={badLines}
          />
        </div>
        <div className="sim-center">
          {trace.map && frame ? (
            <MineGrid trace={trace} frame={frame} />
          ) : (
            <Empty title="A térkép érvénytelen">{trace.mapErrors.join(" ")}</Empty>
          )}
          <div className="sim-gauges">
            <span>
              <small>lépés</small>
              <strong>{frame?.steps ?? 0}</strong>
            </span>
            <span>
              <small>arany</small>
              <strong>{frame?.gold ?? 0}</strong>
            </span>
            <span>
              <small>sor</small>
              <strong>{frame?.line ?? "–"}</strong>
            </span>
            <span>
              <small>irány</small>
              <strong>{frame ? DIR_TEXT[frame.robot.dir] : "–"}</strong>
            </span>
            <span>
              <small>esemény</small>
              <strong>
                {index}/{events.length}
              </strong>
            </span>
          </div>
          {atEnd && outcome ? (
            <p className={`sim-outcome out-${outcome.kind}`}>
              {outcome.kind === "ok"
                ? "A program hiba nélkül véget ért."
                : outcome.kind === "runtimeError"
                  ? `${outcome.code} · ${outcome.line}. sor`
                  : `Szintaktikai hiba: ${trace.syntax.wasm.map((item) => `${item.line}. sor ${item.code}`).join(", ")}`}
            </p>
          ) : null}
        </div>
        <div className="sim-right">
          <h3 className="sim-h">Változók</h3>
          {frame && frame.variables.size ? (
            <dl className="sim-vars">
              {[...frame.variables].map(([name, value]) => (
                <div key={name} className={frame.event?.assigned?.name === name ? "var-new" : ""}>
                  <dt>{name}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="muted small">Még nincs változó.</p>
          )}
          <h3 className="sim-h">Konzol</h3>
          <pre className="sim-console">{(frame?.console ?? []).slice(-200).join("\n") || " "}</pre>
        </div>
      </div>
    </div>
  );
}

function Checks({ trace }: { trace: Trace }) {
  return (
    <div className="sim-checks">
      <div className="detail-head">
        <h3 className="sim-h">Ellenőrzés</h3>
        <span className={`pill pill-${trace.verdict}`}>
          {trace.verdict === "passed" ? <Check size={14} /> : <Cross size={14} />}
          {trace.verdict === "passed" ? "megfelel" : "eltérés"}
        </span>
      </div>
      <ul className="check-list">
        {trace.checks.map((item) => (
          <li key={item.label} className={item.ok ? "check-ok" : "check-bad"}>
            <span aria-hidden="true">{item.ok ? "✓" : "✗"}</span>
            <span className="sr-only">{item.ok ? "rendben" : "hibás"}: </span>
            <span>{item.label}</span>
            {item.ok ? (
              <span className="mono small muted">{item.got}</span>
            ) : (
              <span className="mono small">
                kapott {item.got} · elvárt {item.want}
              </span>
            )}
          </li>
        ))}
      </ul>
      <p className="muted small">
        Futásidő: WASM {trace.durations.wasmMs} ms · referencia {trace.durations.referenceMs} ms ·{" "}
        {trace.wasm?.events.length ?? 0} esemény
      </p>
    </div>
  );
}

function Simulator({ initialCase }: { initialCase?: string | undefined }) {
  const casesQuery = useQuery({
    queryKey: ["engine-cases"],
    queryFn: () => api<{ cases: EngineCaseLite[] }>("/api/engine/cases"),
    staleTime: 300_000,
  });
  const [needle, setNeedle] = useState("");
  const [source, setSource] = useState<"mind" | "kiírás" | "conformance">("mind");
  const debounced = useDebounced(needle, 150);
  const [selected, setSelected] = useState<string | null>(initialCase ?? null);
  const [verdicts, setVerdicts] = useState<Map<string, "passed" | "failed">>(new Map());
  const [autopilot, setAutopilot] = useState(false);
  const [autoSpeed, setAutoSpeed] = useState(120);
  const [sandbox, setSandbox] = useState(false);
  const [program, setProgram] = useState(
    "set count to 0\nset fal to isThere 1\nset megy to not fal\nwhile megy\n  set arany to isThere 2\n  if arany\n    step forward 1\n    mine here\n    set count to count + 1\n  else\n    step forward 1\n  set fal to isThere 1\n  set megy to not fal\nprint count\n",
  );
  const [mapText, setMapText] = useState("1 6\n>.@.@#\n");
  const [sandboxTrace, setSandboxTrace] = useState<Trace | null>(null);
  const cases = casesQuery.data?.cases ?? [];
  const filtered = useMemo(() => {
    const lower = debounced.toLowerCase();
    return cases.filter(
      (item) =>
        (source === "mind" || item.source === source) &&
        (!lower || `${item.name} ${item.group} ${item.ref}`.toLowerCase().includes(lower)),
    );
  }, [cases, debounced, source]);
  const traceQuery = useQuery({
    queryKey: ["trace", selected],
    queryFn: () => api<Trace>(`/api/engine/trace?id=${encodeURIComponent(selected ?? "")}`),
    enabled: Boolean(selected) && !sandbox,
  });
  useEffect(() => {
    const trace = traceQuery.data;
    if (trace?.case)
      setVerdicts((current) => new Map(current).set(trace.case?.id ?? "", trace.verdict));
  }, [traceQuery.data]);
  const advance = () => {
    if (!autopilot || !selected) return;
    const position = filtered.findIndex((item) => item.id === selected);
    const next = filtered[position + 1];
    if (next) setSelected(next.id);
    else {
      setAutopilot(false);
      toast(
        `Robotpilóta kész: ${[...verdicts.values()].filter((v) => v === "failed").length} eltérés.`,
        "ok",
      );
    }
  };
  const tested = filtered.filter((item) => verdicts.has(item.id)).length;
  const failed = filtered.filter((item) => verdicts.get(item.id) === "failed").length;
  const runSandbox = async () => {
    try {
      setSandboxTrace(
        await api<Trace>("/api/engine/trace", { method: "POST", body: { program, map: mapText } }),
      );
    } catch (error) {
      toast((error as Error).message, "fail");
    }
  };
  const listBox = useRef<HTMLOListElement>(null);
  useEffect(() => {
    listBox.current?.querySelector(".active")?.scrollIntoView({ block: "nearest" });
  }, [selected]);
  return (
    <div className="split-page engine-split">
      <aside className="side-list" aria-label="Tesztesetek">
        <div className="side-head">
          <SearchField
            className="search"
            value={needle}
            onChange={setNeedle}
            aria-label="Tesztesetek keresése"
          >
            <Search />
            <Input className="input" placeholder={`Keresés ${cases.length} eset között…`} />
          </SearchField>
          <div className="segmented" role="radiogroup" aria-label="Forrás">
            {(["mind", "kiírás", "conformance"] as const).map((value) => (
              <Button
                key={value}
                className={`segment${source === value ? " active" : ""}`}
                aria-pressed={source === value}
                onPress={() => setSource(value)}
              >
                {value}
              </Button>
            ))}
          </div>
          <div className="autopilot">
            <Button
              className={`button ${autopilot ? "danger" : "primary"} small`}
              onPress={() => {
                if (autopilot) return setAutopilot(false);
                setSandbox(false);
                setVerdicts(new Map());
                setSelected(filtered[0]?.id ?? null);
                setAutopilot(true);
              }}
            >
              {autopilot ? <Stop size={14} /> : <Bolt size={14} />}{" "}
              {autopilot ? "Robotpilóta leállítása" : `Robotpilóta: mind a(z) ${filtered.length}`}
            </Button>
            <Slider
              className="slider compact"
              value={autoSpeed}
              onChange={setAutoSpeed}
              minValue={20}
              maxValue={2000}
              aria-label="Robotpilóta sebessége"
            >
              <SliderTrack className="slider-track">
                <SliderThumb className="slider-thumb" />
              </SliderTrack>
            </Slider>
            <span className="muted small mono">
              {tested}/{filtered.length} · {failed} eltérés
            </span>
          </div>
          <Switch
            className="switch"
            isSelected={sandbox}
            onChange={(value) => {
              setSandbox(value);
              setAutopilot(false);
            }}
          >
            <span className="switch-track" aria-hidden="true" />
            Saját program (homokozó)
          </Switch>
        </div>
        <ol className="side-items" ref={listBox}>
          {filtered.slice(0, 600).map((item) => {
            const verdict = verdicts.get(item.id);
            return (
              <li key={item.id}>
                <button
                  type="button"
                  className={`side-item case-pick${item.id === selected && !sandbox ? " active" : ""}`}
                  onClick={() => {
                    setSandbox(false);
                    setAutopilot(false);
                    setSelected(item.id);
                  }}
                >
                  <span className={`case-dot ${verdict ?? "unknown"}`} aria-hidden="true" />
                  <span className="side-title">
                    <Highlight text={item.name} needle={debounced} />
                  </span>
                  <span className="muted small">
                    {item.source} · {item.group}
                    {item.kind === "syntax" ? " · szintaxis" : ""}
                    {verdict ? ` · ${verdict === "passed" ? "megfelel" : "ELTÉRÉS"}` : ""}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </aside>
      <section className="main-pane" aria-label="Szimulált motor">
        {sandbox ? (
          <div className="stack">
            <div className="form-grid">
              <TextField className="field" value={program} onChange={setProgram}>
                <Label>Program</Label>
                <TextArea className="input textarea mono" rows={10} spellCheck={false} />
              </TextField>
              <TextField className="field" value={mapText} onChange={setMapText}>
                <Label>Térkép</Label>
                <TextArea className="input textarea mono" rows={10} spellCheck={false} />
              </TextField>
            </div>
            <Button className="button primary" onPress={() => void runSandbox()}>
              <Play /> Futtatás mindkét motoron
            </Button>
            {sandboxTrace ? (
              <>
                <Player trace={sandboxTrace} autoplaySpeed={12} />
                <Checks trace={sandboxTrace} />
              </>
            ) : null}
          </div>
        ) : !selected ? (
          <Empty title="Válassz egy tesztesetet">
            Vagy indítsd a robotpilótát: sorban végigjátssza és ellenőrzi az összes esetet.
          </Empty>
        ) : traceQuery.isPending ? (
          <p className="muted" role="status">
            A motor dolgozik…
          </p>
        ) : traceQuery.isError ? (
          <Empty title="Nem futtatható">{(traceQuery.error as Error).message}</Empty>
        ) : (
          <div className="stack">
            <div className="detail-head">
              <div>
                <p className="eyebrow">
                  {traceQuery.data.case?.source} · {traceQuery.data.case?.group}
                </p>
                <h2>{traceQuery.data.case?.name}</h2>
              </div>
              <Button
                className="button ghost small"
                onPress={() => navigate({ page: "engine", testCase: selected })}
              >
                <Repeat size={14} /> Hivatkozás
              </Button>
            </div>
            <Player
              trace={traceQuery.data}
              {...(autopilot ? { autoplaySpeed: autoSpeed, onFinished: advance } : {})}
            />
            <Checks trace={traceQuery.data} />
          </div>
        )}
      </section>
    </div>
  );
}

function sparkline(cases: LiveCase[], buckets = 40): number[] {
  const done = cases.filter((item) => item.status !== "running");
  if (done.length < 2) return [];
  const first = Math.min(...done.map((item) => item.startedAt));
  const last = Math.max(...done.map((item) => item.startedAt)) + 1;
  const width = (last - first) / buckets;
  const counts = Array.from({ length: buckets }, () => 0);
  for (const item of done) {
    const bucket = Math.min(buckets - 1, Math.floor((item.startedAt - first) / width));
    counts[bucket] = (counts[bucket] ?? 0) + 1;
  }
  return counts;
}

function LiveRun({ runId }: { runId?: string | undefined }) {
  const runs = useLive((state) => state.runs);
  const live = useLive((state) => state.live);
  const now = useNow(1000);
  const all = [...runs.values()].sort((a, b) => b.queuedAt - a.queuedAt);
  const running = all.find((run) => run.status === "running");
  const chosen = runId ? runs.get(runId) : (running ?? all[0]);
  const [follow, setFollow] = useState(true);
  const [picked, setPicked] = useState<number | null>(null);
  const [filter, setFilter] = useState<"mind" | "fut" | "hibás">("mind");
  useEffect(() => {
    if (!chosen) return;
    void api<{ cases: LiveCase[] }>(`/api/runs/${chosen.id}/live`).then(({ cases }) =>
      useLive.getState().mergeLive(chosen.id, cases, true),
    );
  }, [chosen?.id]);
  const cases = useMemo(
    () => [...(chosen ? (live.get(chosen.id)?.values() ?? []) : [])].sort((a, b) => a.seq - b.seq),
    [live, chosen],
  );
  const current = [...cases].reverse().find((item) => item.status === "running");
  const focus = follow ? (current ?? cases.at(-1)) : cases.find((item) => item.seq === picked);
  const shown = cases.filter(
    (item) =>
      filter === "mind" ||
      (filter === "fut" ? item.status === "running" : item.status === "failed"),
  );
  const spark = sparkline(cases);
  const peak = Math.max(1, ...spark);
  const slowest = [...cases]
    .filter((item) => item.durationMs !== null)
    .sort((a, b) => (b.durationMs ?? 0) - (a.durationMs ?? 0))
    .slice(0, 8);
  const listBox = useRef<HTMLOListElement>(null);
  useEffect(() => {
    if (follow && listBox.current) listBox.current.scrollTop = listBox.current.scrollHeight;
  }, [cases.length, follow]);
  if (!chosen)
    return (
      <Empty title="Még nem futott semmi">
        Indíts egy csomagot a Csomagok oldalon, és itt élőben látod a tesztjeit.
      </Empty>
    );
  const counts = {
    passed: cases.filter((item) => item.status === "passed").length,
    failed: cases.filter((item) => item.status === "failed").length,
    skipped: cases.filter((item) => item.status === "skipped").length,
  };
  return (
    <div className="stack">
      <div className="live-head">
        <div>
          <p className="eyebrow">
            {chosen.status === "running" ? "élő adás" : "visszanézés"} ·{" "}
            {formatTime(chosen.startedAt ?? chosen.queuedAt)}
          </p>
          <h2>{chosen.title}</h2>
          <p className="muted small mono">{chosen.command || "beépített vizsgálat"}</p>
        </div>
        <div className="live-pick">
          <StatusPill status={chosen.status} />
          <select
            className="input"
            aria-label="Futás kiválasztása"
            value={chosen.id}
            onChange={(event) => navigate({ page: "engine", run: event.target.value })}
          >
            {all.slice(0, 60).map((run: RunSummary) => (
              <option key={run.id} value={run.id}>
                {run.status === "running" ? "▶ " : ""}
                {run.title} · {formatTime(run.queuedAt)}
              </option>
            ))}
          </select>
        </div>
      </div>
      {chosen.status === "running" ? <RunProgress run={chosen} /> : null}
      <div className="live-meters">
        <div className="live-meter">
          <small>tesztek</small>
          <strong>{cases.length}</strong>
          <CountTriplet {...counts} />
        </div>
        <div className="live-meter">
          <small>most fut</small>
          <strong className="live-now">
            {current
              ? (current.name ?? `#${current.seq} teszt`)
              : chosen.status === "running"
                ? "fordítás, előkészítés…"
                : "–"}
          </strong>
          {current ? (
            <span className="muted small mono">{formatDuration(now - current.startedAt)}</span>
          ) : null}
        </div>
        <div className="live-meter grow">
          <small>ütem (teszt / időszelet)</small>
          <div className="spark" aria-hidden="true">
            {spark.map((value, index) => (
              <i key={`${index}-${value}`} style={{ height: `${(value / peak) * 100}%` }} />
            ))}
          </div>
        </div>
      </div>
      <div className="live-grid">
        <Panel
          title={`Tesztek élőben (${shown.length})`}
          actions={
            <div className="toolbar">
              <div className="segmented" role="radiogroup" aria-label="Szűrés">
                {(["mind", "fut", "hibás"] as const).map((value) => (
                  <Button
                    key={value}
                    className={`segment${filter === value ? " active" : ""}`}
                    aria-pressed={filter === value}
                    onPress={() => setFilter(value)}
                  >
                    {value}
                  </Button>
                ))}
              </div>
              <Switch className="switch" isSelected={follow} onChange={setFollow}>
                <span className="switch-track" aria-hidden="true" />
                követés
              </Switch>
            </div>
          }
        >
          {cases.length === 0 ? (
            <Empty
              title={
                chosen.status === "running"
                  ? "A csomag indul…"
                  : "Ehhez a futáshoz nincs tesztenkénti adás"
              }
            >
              {chosen.status === "running"
                ? "Fordítás vagy előkészítés zajlik; az első teszt indulásakor itt jelenik meg."
                : "A beépített vizsgálatok és a lint eredménye a Futások oldalon látszik."}
            </Empty>
          ) : (
            <ol className="live-list" ref={listBox}>
              {shown.slice(-1500).map((item) => (
                <li key={item.seq}>
                  <button
                    type="button"
                    className={`live-item st-${item.status}${focus?.seq === item.seq ? " active" : ""}`}
                    onClick={() => {
                      setFollow(false);
                      setPicked(item.seq);
                    }}
                  >
                    <span className="live-seq mono">#{item.seq}</span>
                    <span className="live-mark" aria-hidden="true">
                      {item.status === "running" ? (
                        <Play size={12} />
                      ) : item.status === "passed" ? (
                        <Check size={12} />
                      ) : item.status === "failed" ? (
                        <Cross size={12} />
                      ) : (
                        <Square size={12} />
                      )}
                    </span>
                    <span className="live-name">
                      {item.name ??
                        (item.status === "running" ? "fut…" : "név a futás végén érkezik")}
                    </span>
                    <span className="live-bar" aria-hidden="true">
                      <i
                        style={{
                          width: `${Math.min(100, ((item.durationMs ?? now - item.startedAt) / Math.max(1, slowest[0]?.durationMs ?? 1)) * 100)}%`,
                        }}
                      />
                    </span>
                    <span className="mono small muted">
                      {item.durationMs !== null
                        ? formatDuration(item.durationMs)
                        : formatDuration(now - item.startedAt)}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </Panel>
        <div className="stack">
          <Panel title={focus ? `#${focus.seq} – belülről` : "Kiválasztott teszt"}>
            {focus ? (
              <>
                <p className="live-focus-name">
                  {focus.name ??
                    "A teszt neve a futás végén érkezik (a Bun csak a hibás teszteket nevezi meg futás közben)."}
                </p>
                <p className="muted small">
                  {focus.status === "running"
                    ? "fut"
                    : focus.status === "passed"
                      ? "sikeres"
                      : focus.status === "failed"
                        ? "SIKERTELEN"
                        : "kihagyva"}{" "}
                  · {formatDuration(focus.durationMs ?? now - focus.startedAt)}
                </p>
                <pre className="code-block live-output">
                  {focus.output.length ? focus.output.join("\n") : "Ez a teszt nem írt kimenetet."}
                </pre>
              </>
            ) : (
              <p className="muted small">Kattints egy tesztre a listában.</p>
            )}
          </Panel>
          <Panel title="Leglassabb tesztek">
            <ul className="list">
              {slowest.map((item) => (
                <li key={item.seq} className="slow-item">
                  <span className="mono small">{formatDuration(item.durationMs)}</span>
                  <span className="list-title">{item.name ?? `#${item.seq}`}</span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  );
}

export function EngineRoom({
  runId,
  testCase,
}: {
  runId?: string | undefined;
  testCase?: string | undefined;
}) {
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">Motortér</p>
          <h1>Belülről nézve</h1>
          <p className="muted">
            Élőben a futó tesztek, vagy lépésről lépésre a MineScript-motor: a program sora, a
            robot, a változók és a konzol, mindkét motoron.
          </p>
        </div>
      </div>
      <Tabs className="tabs" defaultSelectedKey={testCase ? "sim" : "live"}>
        <TabList className="tab-list" aria-label="Motortér nézetei">
          <Tab id="live" className="tab">
            Élő futás
          </Tab>
          <Tab id="sim" className="tab">
            Szimulált motor
          </Tab>
        </TabList>
        <TabPanel id="live" className="tab-panel">
          <LiveRun runId={runId} />
        </TabPanel>
        <TabPanel id="sim" className="tab-panel">
          <Simulator initialCase={testCase} />
        </TabPanel>
      </Tabs>
    </div>
  );
}
