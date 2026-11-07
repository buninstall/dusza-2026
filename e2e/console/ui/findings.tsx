import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Cell,
  Checkbox,
  Column,
  Input,
  Label,
  ListBox,
  ListBoxItem,
  Menu,
  MenuItem,
  MenuTrigger,
  Popover,
  Row,
  SearchField,
  Select,
  type Selection,
  SelectValue,
  type SortDescriptor,
  Switch,
  Table,
  TableBody,
  TableHeader,
  TextArea,
  TextField,
} from "react-aria-components";
import { api, type Finding } from "./api.ts";
import { Empty, SeverityTag, toast, useCopy, useDebounced } from "./components.tsx";
import { Check, Copy, Download, Search } from "./icons.tsx";
import {
  FINDING_STATUSES,
  formatTime,
  href,
  navigate,
  OPEN_STATUSES,
  OWNERS,
  SEVERITIES,
  useLive,
} from "./state.ts";

function Picker({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
}) {
  return (
    <Select
      className="field select"
      selectedKey={value}
      onSelectionChange={(key) => onChange(String(key))}
    >
      <Label>{label}</Label>
      <Button className="select-button">
        <SelectValue />
        <span aria-hidden="true">▾</span>
      </Button>
      <Popover className="popover">
        <ListBox className="listbox">
          {options.map((option) => (
            <ListBoxItem key={option} id={option} className="option">
              {option}
            </ListBoxItem>
          ))}
        </ListBox>
      </Popover>
    </Select>
  );
}

function FindingDetail({ finding }: { finding: Finding }) {
  const copy = useCopy();
  const [status, setStatus] = useState<string>(finding.status);
  const [severity, setSeverity] = useState<string>(finding.severity);
  const [owner, setOwner] = useState<string>(finding.owner);
  const [note, setNote] = useState(finding.note);
  useEffect(() => {
    setStatus(finding.status);
    setSeverity(finding.severity);
    setOwner(finding.owner);
    setNote(finding.note);
  }, [finding]);
  const dirty =
    status !== finding.status ||
    severity !== finding.severity ||
    owner !== finding.owner ||
    note !== finding.note;
  const save = async () => {
    try {
      await api<Finding>(`/api/findings/${finding.id}`, {
        method: "PATCH",
        body: { status, severity, owner, note },
      });
      await useLive.getState().load();
      toast("Mentve.", "ok");
    } catch (error) {
      toast((error as Error).message, "fail");
    }
  };
  const location = finding.file
    ? `${finding.file}${finding.line ? `:${finding.line}` : ""}`
    : "nem állapítható meg";
  return (
    <div className="detail">
      <div className="detail-head">
        <div>
          <p className="eyebrow">
            {finding.suiteId} · {finding.owner}
          </p>
          <h2>{finding.title}</h2>
        </div>
        <SeverityTag severity={finding.severity} />
      </div>
      <p className="case-message">{finding.message ?? "Nincs üzenet."}</p>
      <dl className="facts">
        <dt>Hely</dt>
        <dd className="mono">{location}</dd>
        <dt>Előfordulás</dt>
        <dd>
          {finding.occurrences}× · először {formatTime(finding.firstSeen)} · utoljára{" "}
          {formatTime(finding.lastSeen)}
        </dd>
        <dt>Előzmény</dt>
        <dd>
          <span
            className="history"
            role="img"
            aria-label={`Az utolsó ${finding.history.length} futás: ${finding.history.map((item) => (item === "failed" ? "sikertelen" : "sikeres")).join(", ")}`}
          >
            {finding.history.map((item, index) => (
              <i
                key={`${index}-${item}`}
                className={item === "failed" ? "cell-failed" : "cell-passed"}
              />
            ))}
          </span>
          {finding.flaky ? (
            <strong className="warn-text"> instabil: hol sikeres, hol nem</strong>
          ) : null}
        </dd>
      </dl>
      <div className="form-grid">
        <Picker label="Állapot" value={status} options={FINDING_STATUSES} onChange={setStatus} />
        <Picker label="Súlyosság" value={severity} options={SEVERITIES} onChange={setSeverity} />
        <Picker label="Felelős" value={owner} options={OWNERS} onChange={setOwner} />
      </div>
      <TextField className="field" value={note} onChange={setNote} maxLength={10_000}>
        <Label>Megjegyzés (reprodukció, döntés, kinek továbbítva)</Label>
        <TextArea className="input textarea" rows={4} />
      </TextField>
      <div className="toolbar">
        <Button className="button primary" isDisabled={!dirty} onPress={() => void save()}>
          Mentés
        </Button>
        <Button
          className="button"
          onPress={() =>
            void api<string>(`/api/findings/${finding.id}/report.md`).then((text) =>
              copy(text, "A hibajelentés a vágólapon."),
            )
          }
        >
          <Copy /> Hibajelentés másolása
        </Button>
        <a
          className="button ghost"
          href={`/api/findings/${finding.id}/report.md`}
          download={`hiba-${finding.id}.md`}
        >
          <Download /> .md
        </a>
        <Button
          className="button ghost"
          onPress={() => navigate({ page: "runs", run: finding.lastRunId })}
        >
          Utolsó futás
        </Button>
      </div>
      {finding.details ? <pre className="code-block">{finding.details}</pre> : null}
    </div>
  );
}

const COLUMNS = [
  { id: "severity", name: "Súlyosság" },
  { id: "title", name: "Találat" },
  { id: "suiteId", name: "Csomag" },
  { id: "owner", name: "Felelős" },
  { id: "status", name: "Állapot" },
  { id: "lastSeen", name: "Utoljára" },
] as const;

export function Findings({ findingId }: { findingId?: string | undefined }) {
  const findings = useLive((state) => state.findings);
  const suites = useLive((state) => state.suites);
  const params = new URLSearchParams(window.location.hash.split("?")[1] ?? "");
  const [statusFilter, setStatusFilter] = useState("nyitott");
  const [severityFilter, setSeverityFilter] = useState("mind");
  const [ownerFilter, setOwnerFilter] = useState("mind");
  const [suiteFilter, setSuiteFilter] = useState(params.get("suite") ?? "mind");
  const [flakyOnly, setFlakyOnly] = useState(false);
  const [needle, setNeedle] = useState("");
  const debounced = useDebounced(needle, 150);
  const [sort, setSort] = useState<SortDescriptor>({ column: "severity", direction: "ascending" });
  const [selection, setSelection] = useState<Selection>(new Set());
  const list = useMemo(() => {
    const lower = debounced.toLowerCase();
    const filtered = findings.filter(
      (finding) =>
        (statusFilter === "mind" ||
          (statusFilter === "nyitott"
            ? OPEN_STATUSES.has(finding.status)
            : finding.status === statusFilter)) &&
        (severityFilter === "mind" || finding.severity === severityFilter) &&
        (ownerFilter === "mind" || finding.owner === ownerFilter) &&
        (suiteFilter === "mind" || finding.suiteId === suiteFilter) &&
        (!flakyOnly || finding.flaky) &&
        (!lower ||
          `${finding.title} ${finding.message ?? ""} ${finding.file ?? ""} ${finding.note}`
            .toLowerCase()
            .includes(lower)),
    );
    const direction = sort.direction === "descending" ? -1 : 1;
    return filtered.sort((a, b) => {
      const column = String(sort.column);
      if (column === "severity")
        return (
          direction * (SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity)) ||
          b.lastSeen - a.lastSeen
        );
      if (column === "lastSeen") return direction * (a.lastSeen - b.lastSeen);
      return (
        direction *
        String(a[column as keyof Finding]).localeCompare(String(b[column as keyof Finding]), "hu")
      );
    });
  }, [
    findings,
    statusFilter,
    severityFilter,
    ownerFilter,
    suiteFilter,
    flakyOnly,
    debounced,
    sort,
  ]);
  const selectedIds =
    selection === "all" ? list.map((finding) => finding.id) : [...selection].map(String);
  const current = findings.find((finding) => finding.id === findingId);
  const bulk = async (changes: Record<string, string>) => {
    try {
      const { updated } = await api<{ updated: number }>("/api/findings/bulk", {
        method: "POST",
        body: { ids: selectedIds, ...changes },
      });
      await useLive.getState().load();
      setSelection(new Set());
      toast(`${updated} találat frissítve.`, "ok");
    } catch (error) {
      toast((error as Error).message, "fail");
    }
  };
  const exportQuery = statusFilter === "nyitott" ? "" : "?all=1";
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">Hibanapló</p>
          <h1>Találatok</h1>
        </div>
        <MenuTrigger>
          <Button className="button">
            <Download /> Export ▾
          </Button>
          <Popover className="popover">
            <Menu
              className="menu"
              onAction={(key) => {
                const link = document.createElement("a");
                link.href = `/api/findings/export.${String(key)}${exportQuery}`;
                link.download = `hibajelentesek.${String(key)}`;
                link.click();
              }}
            >
              <MenuItem id="md" className="option">
                Markdown hibajelentések (BUG-sablon)
              </MenuItem>
              <MenuItem id="csv" className="option">
                CSV táblázat (Excel)
              </MenuItem>
              <MenuItem id="json" className="option">
                JSON (gépi feldolgozás)
              </MenuItem>
            </Menu>
          </Popover>
        </MenuTrigger>
      </div>
      <div className="filters">
        <SearchField
          className="search wide"
          value={needle}
          onChange={setNeedle}
          aria-label="Keresés a találatok között"
        >
          <Search />
          <Input
            className="input"
            placeholder="Keresés címben, üzenetben, fájlban, megjegyzésben…"
          />
        </SearchField>
        <Picker
          label="Állapot"
          value={statusFilter}
          options={["nyitott", "mind", ...FINDING_STATUSES]}
          onChange={setStatusFilter}
        />
        <Picker
          label="Súlyosság"
          value={severityFilter}
          options={["mind", ...SEVERITIES]}
          onChange={setSeverityFilter}
        />
        <Picker
          label="Felelős"
          value={ownerFilter}
          options={["mind", ...OWNERS]}
          onChange={setOwnerFilter}
        />
        <Picker
          label="Csomag"
          value={suiteFilter}
          options={["mind", ...suites.map((suite) => suite.id)]}
          onChange={setSuiteFilter}
        />
        <Switch className="switch" isSelected={flakyOnly} onChange={setFlakyOnly}>
          <span className="switch-track" aria-hidden="true" />
          Csak instabil
        </Switch>
      </div>
      {selectedIds.length ? (
        <div className="bulkbar" role="toolbar" aria-label="Tömeges műveletek">
          <strong>{selectedIds.length} kijelölve</strong>
          <Button className="button small" onPress={() => void bulk({ status: "megerősítve" })}>
            Megerősítve
          </Button>
          <Button className="button small" onPress={() => void bulk({ status: "jelentve" })}>
            Jelentve
          </Button>
          <Button className="button small" onPress={() => void bulk({ status: "javítva" })}>
            Javítva
          </Button>
          <Button className="button small" onPress={() => void bulk({ status: "hamis riasztás" })}>
            Hamis riasztás
          </Button>
          {OWNERS.map((name) => (
            <Button
              key={name}
              className="button ghost small"
              onPress={() => void bulk({ owner: name })}
            >
              → {name}
            </Button>
          ))}
        </div>
      ) : null}
      <div className="split-page findings-split">
        <div className="table-wrap">
          {list.length ? (
            <Table
              aria-label={`Találatok (${list.length})`}
              className="table"
              selectionMode="multiple"
              selectedKeys={selection}
              onSelectionChange={setSelection}
              sortDescriptor={sort}
              onSortChange={setSort}
              onRowAction={(key) => navigate({ page: "findings", finding: String(key) })}
            >
              <TableHeader>
                <Column className="column check-column">
                  <Checkbox slot="selection" className="check" aria-label="Összes kijelölése">
                    <span className="check-box" aria-hidden="true">
                      <Check size={12} />
                    </span>
                  </Checkbox>
                </Column>
                {COLUMNS.map((column) => (
                  <Column
                    key={column.id}
                    id={column.id}
                    isRowHeader={column.id === "title"}
                    allowsSorting
                    className="column"
                  >
                    {({ sortDirection }) => (
                      <span className="column-label">
                        {column.name}
                        <span aria-hidden="true">
                          {sortDirection === "ascending"
                            ? " ▴"
                            : sortDirection === "descending"
                              ? " ▾"
                              : ""}
                        </span>
                      </span>
                    )}
                  </Column>
                ))}
              </TableHeader>
              <TableBody items={list}>
                {(finding) => (
                  <Row
                    id={finding.id}
                    className={`row${finding.id === findingId ? " active" : ""}`}
                  >
                    <Cell className="cell-check">
                      <Checkbox
                        slot="selection"
                        className="check"
                        aria-label={`${finding.title} kijelölése`}
                      >
                        <span className="check-box" aria-hidden="true">
                          <Check size={12} />
                        </span>
                      </Checkbox>
                    </Cell>
                    <Cell>
                      <SeverityTag severity={finding.severity} />
                    </Cell>
                    <Cell>
                      <a
                        className="row-title"
                        href={href({ page: "findings", finding: finding.id })}
                      >
                        {finding.title}
                      </a>
                      <span className="muted small row-sub">{finding.message}</span>
                    </Cell>
                    <Cell className="mono small">{finding.suiteId}</Cell>
                    <Cell>{finding.owner}</Cell>
                    <Cell>
                      <span
                        className={`status-tag st-${FINDING_STATUSES.indexOf(finding.status as (typeof FINDING_STATUSES)[number])}`}
                      >
                        {finding.status}
                      </span>
                      {finding.flaky ? <span className="chip chip-warn">instabil</span> : null}
                    </Cell>
                    <Cell className="small">{formatTime(finding.lastSeen)}</Cell>
                  </Row>
                )}
              </TableBody>
            </Table>
          ) : (
            <Empty title="Nincs a szűrőnek megfelelő találat" />
          )}
        </div>
        <aside className="main-pane" aria-label="A kiválasztott találat">
          {current ? (
            <FindingDetail finding={current} />
          ) : (
            <Empty title="Válassz egy találatot">
              A sorra kattintva megnyílik a részletes hibajelentés.
            </Empty>
          )}
        </aside>
      </div>
    </div>
  );
}
