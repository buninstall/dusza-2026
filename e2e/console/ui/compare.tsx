import { useQuery } from "@tanstack/react-query";
import {
  Button,
  Label,
  ListBox,
  ListBoxItem,
  Popover,
  Select,
  SelectValue,
} from "react-aria-components";
import { api, type Comparison, type TestCase } from "./api.ts";
import { Empty, Panel, StatusPill } from "./components.tsx";
import { formatTime, navigate, useLive } from "./state.ts";

function RunPicker({
  label,
  value,
  onChange,
  suiteId,
}: {
  label: string;
  value: string | undefined;
  onChange: (id: string) => void;
  suiteId: string | null;
}) {
  const runs = useLive((state) => state.runs);
  const options = [...runs.values()]
    .filter(
      (run) => ["passed", "failed"].includes(run.status) && (!suiteId || run.suiteId === suiteId),
    )
    .sort((a, b) => b.queuedAt - a.queuedAt)
    .slice(0, 200);
  return (
    <Select
      className="field select wide"
      selectedKey={value ?? null}
      onSelectionChange={(key) => onChange(String(key))}
    >
      <Label>{label}</Label>
      <Button className="select-button">
        <SelectValue>{({ selectedText }) => selectedText ?? "Válassz futást…"}</SelectValue>
        <span aria-hidden="true">▾</span>
      </Button>
      <Popover className="popover">
        <ListBox className="listbox" items={options}>
          {(run) => (
            <ListBoxItem
              id={run.id}
              className="option"
              textValue={`${run.title} ${formatTime(run.queuedAt)}`}
            >
              <StatusPill status={run.status} compact /> {run.title} · {formatTime(run.queuedAt)}
            </ListBoxItem>
          )}
        </ListBox>
      </Popover>
    </Select>
  );
}

function CaseList({ title, cases, tone }: { title: string; cases: TestCase[]; tone: string }) {
  return (
    <Panel title={`${title} (${cases.length})`} className={`compare-${tone}`}>
      {cases.length ? (
        <ul className="list">
          {cases.slice(0, 300).map((item) => (
            <li key={item.key} className="compare-item">
              <span className="list-title">{item.name}</span>
              {item.message ? <span className="muted small">{item.message}</span> : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted small">Nincs ilyen eset.</p>
      )}
    </Panel>
  );
}

export function Compare({ a, b }: { a?: string | undefined; b?: string | undefined }) {
  const runs = useLive((state) => state.runs);
  const suiteId = (a && runs.get(a)?.suiteId) || null;
  const query = useQuery({
    queryKey: ["compare", a, b],
    queryFn: () => api<Comparison>(`/api/compare?a=${a}&b=${b}`),
    enabled: Boolean(a && b),
  });
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">Rétegvizsgálat</p>
          <h1>Két futás összevetése</h1>
        </div>
      </div>
      <div className="filters">
        <RunPicker
          label="Korábbi futás (A)"
          value={a}
          suiteId={null}
          onChange={(id) => navigate({ page: "compare", a: id, ...(b ? { b } : {}) })}
        />
        <RunPicker
          label="Későbbi futás (B)"
          value={b}
          suiteId={suiteId}
          onChange={(id) => navigate({ page: "compare", ...(a ? { a } : {}), b: id })}
        />
      </div>
      {!a || !b ? (
        <Empty title="Válassz két futást">
          Ugyanannak a csomagnak két futását érdemes összevetni: kiderül, mi romlott el és mi
          javult.
        </Empty>
      ) : query.isPending ? (
        <p className="muted" role="status">
          Összevetés…
        </p>
      ) : query.isError ? (
        <Empty title="Az összevetés nem sikerült">{(query.error as Error).message}</Empty>
      ) : (
        <div className="compare-grid">
          <CaseList title="Újonnan elromlott" cases={query.data.newlyFailing} tone="fail" />
          <CaseList title="Megjavult" cases={query.data.fixed} tone="ok" />
          <CaseList title="Továbbra is hibás" cases={query.data.stillFailing} tone="warn" />
          <CaseList title="Új eset" cases={query.data.added} tone="info" />
          <CaseList title="Eltűnt eset" cases={query.data.removed} tone="info" />
        </div>
      )}
    </div>
  );
}
