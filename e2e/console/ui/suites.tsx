import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Button,
  Checkbox,
  Dialog,
  DialogTrigger,
  Heading,
  Input,
  Label,
  NumberField,
  Popover,
  SearchField,
  Switch,
} from "react-aria-components";
import {
  api,
  type DiscoveredTest,
  type SuiteView,
  startMany,
  startRuns,
  type Target,
} from "./api.ts";
import {
  CountTriplet,
  Empty,
  Highlight,
  IconButton,
  StatusPill,
  toast,
  useDebounced,
} from "./components.tsx";
import { Check, Play, Repeat, Search } from "./icons.tsx";
import { href, navigate, OPEN_STATUSES, relative, runsOf, useLive, useNow } from "./state.ts";

const NEEDS: Record<string, string> = {
  db: "MySQL",
  build: "build",
  wasm: "WASM",
  live: "futó példány",
  network: "hálózat",
};

async function launch(suite: SuiteView, extra: Parameters<typeof startRuns>[1] = {}) {
  try {
    const { runs } = await startRuns(suite.id, extra);
    toast(
      runs.length > 1
        ? `${runs.length} futás sorba állítva: ${suite.title}`
        : `Sorba állítva: ${runs[0]?.title ?? suite.title}`,
      "ok",
    );
    if (runs.length === 1 && runs[0]) navigate({ page: "runs", run: runs[0].id });
  } catch (error) {
    toast((error as Error).message, "fail");
  }
}

function FlakyDialog({ suite }: { suite: SuiteView }) {
  const [repeat, setRepeat] = useState(5);
  const [randomize, setRandomize] = useState(suite.targets === "bun");
  return (
    <DialogTrigger>
      <Button className="button ghost">
        <Repeat /> Instabilitás-próba
      </Button>
      <Popover className="popover" placement="bottom end">
        <Dialog className="dialog-body" aria-label={`Instabilitás-próba: ${suite.title}`}>
          {({ close }) => (
            <div className="stack">
              <Heading slot="title" className="dialog-title">
                Instabilitás-próba
              </Heading>
              <p className="muted small">
                A csomag többször fut egymás után. Ha egy eset hol sikeres, hol nem, a találat
                „instabil” jelölést kap.
              </p>
              <NumberField
                className="field"
                value={repeat}
                onChange={setRepeat}
                minValue={2}
                maxValue={20}
              >
                <Label>Ismétlések száma</Label>
                <Input className="input" />
              </NumberField>
              {suite.targets === "bun" ? (
                <Switch className="switch" isSelected={randomize} onChange={setRandomize}>
                  <span className="switch-track" aria-hidden="true" />
                  Véletlen tesztsorrend (rögzített seedekkel)
                </Switch>
              ) : null}
              <Button
                className="button primary"
                onPress={() => {
                  close();
                  void launch(suite, { repeat, randomize });
                }}
              >
                <Play /> {repeat}× futtatás
              </Button>
            </div>
          )}
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
}

function TestExplorer({ suite }: { suite: SuiteView }) {
  const [needle, setNeedle] = useState("");
  const debounced = useDebounced(needle, 150);
  const query = useQuery({
    queryKey: ["tests", suite.id],
    queryFn: () => api<{ tests: DiscoveredTest[] }>(`/api/suites/${suite.id}/tests`),
    staleTime: 60_000,
  });
  const tests = query.data?.tests ?? [];
  const shown = useMemo(() => {
    const lower = debounced.toLowerCase();
    return tests
      .filter((test) => `${test.file} ${test.name}`.toLowerCase().includes(lower))
      .slice(0, 300);
  }, [tests, debounced]);
  if (query.isPending)
    return (
      <p className="muted" role="status">
        Tesztek felderítése…
      </p>
    );
  if (query.isError)
    return (
      <p className="error-text">A felderítés nem sikerült: {(query.error as Error).message}</p>
    );
  const targetOf = (test: DiscoveredTest): Target => {
    if (suite.targets === "cargo") return { name: test.name };
    if (suite.targets === "playwright")
      return test.line && test.name ? { file: test.file, line: test.line } : { file: test.file };
    return test.name ? { file: test.file, name: test.name } : { file: test.file };
  };
  return (
    <div className="explorer">
      <SearchField
        className="search"
        value={needle}
        onChange={setNeedle}
        aria-label={`Keresés ${tests.length} teszt között`}
      >
        <Search />
        <Input className="input" placeholder={`Keresés ${tests.length} teszt és fájl között…`} />
      </SearchField>
      {shown.length === 0 ? (
        <Empty title="Nincs találat a keresésre" />
      ) : (
        <ul className="explorer-list">
          {shown.map((test) => (
            <li
              key={`${test.file}:${test.line}:${test.name}`}
              className={test.name ? "explorer-test" : "explorer-file"}
            >
              <span className="explorer-name">
                <Highlight text={test.name || test.file} needle={debounced} />
                {test.name && test.line ? (
                  <span className="muted mono small">
                    {" "}
                    {test.file}:{test.line}
                  </span>
                ) : null}
              </span>
              <IconButton
                label={`Futtatás: ${test.name || test.file}`}
                onPress={() => void launch(suite, { target: targetOf(test) })}
              >
                <Play size={14} />
              </IconButton>
            </li>
          ))}
          {tests.length > shown.length && !debounced ? (
            <li className="muted small">
              …és még {tests.length - shown.length}. Szűkíts a keresővel.
            </li>
          ) : null}
        </ul>
      )}
    </div>
  );
}

function SuiteRow({
  suite,
  selected,
  onSelect,
}: {
  suite: SuiteView;
  selected: boolean;
  onSelect: (value: boolean) => void;
}) {
  const runs = useLive((state) => state.runs);
  const findings = useLive((state) => state.findings);
  const now = useNow(30_000);
  const route = window.location.hash;
  const [open, setOpen] = useState(route.endsWith(`/suites/${suite.id}`));
  const history = runsOf(runs, suite.id).slice(-12);
  const last = history.at(-1);
  const openFindings = findings.filter(
    (finding) => finding.suiteId === suite.id && OPEN_STATUSES.has(finding.status),
  ).length;
  return (
    <article
      className={`suite${open ? " open" : ""}`}
      id={`suite-${suite.id}`}
      aria-labelledby={`suite-title-${suite.id}`}
    >
      <div className="suite-main">
        <Checkbox
          className="check"
          isSelected={selected}
          onChange={onSelect}
          aria-label={`${suite.title} kijelölése`}
        >
          <span className="check-box" aria-hidden="true">
            <Check size={12} />
          </span>
        </Checkbox>
        <div className="suite-text">
          <h3 id={`suite-title-${suite.id}`}>{suite.title}</h3>
          <p className="muted small">{suite.description}</p>
          <div className="chips">
            {suite.long ? <span className="chip">hosszú</span> : null}
            {suite.needs.map((need) => (
              <span key={need} className="chip">
                kell: {NEEDS[need] ?? need}
              </span>
            ))}
            <span className="chip">alap: {suite.severity}</span>
            {openFindings ? (
              <a
                className="chip chip-warn"
                href={`${href({ page: "findings" })}?suite=${suite.id}`}
              >
                {openFindings} nyitott találat
              </a>
            ) : null}
          </div>
        </div>
        <div className="suite-state">
          {last ? (
            <StatusPill status={last.status} />
          ) : (
            <span className="pill pill-none">nem futott</span>
          )}
          <div className="mini-strip" aria-hidden="true">
            {history.map((run) => (
              <i key={run.id} className={`cell-${run.status}`} />
            ))}
          </div>
          {last ? (
            <a className="muted small" href={href({ page: "runs", run: last.id })}>
              {relative(last.finishedAt ?? last.queuedAt, now)} · <CountTriplet {...last.counts} />
            </a>
          ) : null}
        </div>
        <div className="suite-actions">
          <Button className="button primary" onPress={() => void launch(suite)}>
            <Play /> Futtatás
          </Button>
          {suite.id === "reference" ? (
            <Button className="button ghost" onPress={() => void launch(suite, { deep: true })}>
              Mély seedekkel
            </Button>
          ) : null}
          <FlakyDialog suite={suite} />
          {suite.targets !== "none" ? (
            <Button className="button ghost" aria-expanded={open} onPress={() => setOpen(!open)}>
              Egyenként {open ? "▴" : "▾"}
            </Button>
          ) : null}
        </div>
      </div>
      {open && suite.targets !== "none" ? <TestExplorer suite={suite} /> : null}
    </article>
  );
}

export function Suites() {
  const suites = useLive((state) => state.suites);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [needle, setNeedle] = useState("");
  const groups = [...new Set(suites.map((suite) => suite.group))];
  const visible = suites.filter((suite) =>
    `${suite.title} ${suite.description} ${suite.group}`
      .toLowerCase()
      .includes(needle.toLowerCase()),
  );
  const runSelected = async () => {
    try {
      const { runs } = await startMany({ suiteIds: [...selected] });
      toast(`${runs.length} csomag sorba állítva.`, "ok");
      setSelected(new Set());
    } catch (error) {
      toast((error as Error).message, "fail");
    }
  };
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">Fúrási terv</p>
          <h1>Tesztcsomagok</h1>
        </div>
        <div className="toolbar">
          <SearchField
            className="search"
            value={needle}
            onChange={setNeedle}
            aria-label="Csomagok szűrése"
          >
            <Search />
            <Input className="input" placeholder="Csomag szűrése…" />
          </SearchField>
          <Button
            className="button primary"
            isDisabled={selected.size === 0}
            onPress={() => void runSelected()}
          >
            <Play /> Kijelöltek ({selected.size})
          </Button>
        </div>
      </div>
      {groups.map((group) => {
        const members = visible.filter((suite) => suite.group === group);
        if (members.length === 0) return null;
        return (
          <section key={group} className="group" aria-labelledby={`group-${group}`}>
            <div className="group-head">
              <h2 id={`group-${group}`}>{group}</h2>
              <Button
                className="button ghost small"
                onPress={async () => {
                  try {
                    const { runs } = await startMany({ group, includeLong: true });
                    toast(`${runs.length} csomag sorba állítva: ${group}`, "ok");
                  } catch (error) {
                    toast((error as Error).message, "fail");
                  }
                }}
              >
                <Play size={14} /> Csoport
              </Button>
            </div>
            {members.map((suite) => (
              <SuiteRow
                key={suite.id}
                suite={suite}
                selected={selected.has(suite.id)}
                onSelect={(value) => {
                  const next = new Set(selected);
                  if (value) next.add(suite.id);
                  else next.delete(suite.id);
                  setSelected(next);
                }}
              />
            ))}
          </section>
        );
      })}
    </div>
  );
}
