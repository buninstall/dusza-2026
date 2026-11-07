import { useMemo, useState } from "react";
import {
  Dialog,
  Heading,
  Input,
  ListBox,
  ListBoxItem,
  Modal,
  ModalOverlay,
  SearchField,
} from "react-aria-components";
import { api, startMany, startRuns } from "./api.ts";
import { toast, useHotkey } from "./components.tsx";
import { Search } from "./icons.tsx";
import { navigate, type Route, useLive } from "./state.ts";

type Command = { id: string; label: string; hint: string; run: () => void | Promise<void> };

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [needle, setNeedle] = useState("");
  const suites = useLive((state) => state.suites);
  const findings = useLive((state) => state.findings);
  useHotkey("mod+k", () => setOpen((value) => !value));
  const go = (route: Route) => () => navigate(route);
  const commands = useMemo<Command[]>(
    () => [
      {
        id: "go-overview",
        label: "Áttekintés",
        hint: "ugrás · g o",
        run: go({ page: "overview" }),
      },
      { id: "go-suites", label: "Tesztcsomagok", hint: "ugrás · g s", run: go({ page: "suites" }) },
      { id: "go-runs", label: "Futások", hint: "ugrás · g r", run: go({ page: "runs" }) },
      { id: "go-findings", label: "Találatok", hint: "ugrás · g f", run: go({ page: "findings" }) },
      {
        id: "go-compare",
        label: "Két futás összevetése",
        hint: "ugrás · g c",
        run: go({ page: "compare" }),
      },
      { id: "go-settings", label: "Beállítások", hint: "ugrás", run: go({ page: "settings" }) },
      {
        id: "run-quick",
        label: "Gyors csomagok futtatása",
        hint: "futtatás",
        run: async () =>
          toast(
            `${(await startMany({ includeLong: false })).runs.length} csomag sorba állítva.`,
            "ok",
          ),
      },
      {
        id: "run-all",
        label: "Minden csomag futtatása, a hosszúakkal együtt",
        hint: "futtatás",
        run: async () =>
          toast(
            `${(await startMany({ includeLong: true })).runs.length} csomag sorba állítva.`,
            "ok",
          ),
      },
      {
        id: "clear-queue",
        label: "A várakozó sor ürítése",
        hint: "sor",
        run: async () =>
          toast(
            `${(await api<{ removed: number }>("/api/queue/clear", { method: "POST", body: {} })).removed} futás törölve a sorból.`,
          ),
      },
      ...suites.map((suite) => ({
        id: `run-${suite.id}`,
        label: `Futtatás: ${suite.title}`,
        hint: suite.group,
        run: async () => {
          const { runs } = await startRuns(suite.id);
          if (runs[0]) navigate({ page: "runs", run: runs[0].id });
        },
      })),
      ...findings.slice(0, 200).map((finding) => ({
        id: `finding-${finding.id}`,
        label: `Találat: ${finding.title}`,
        hint: `${finding.severity} · ${finding.status}`,
        run: go({ page: "findings", finding: finding.id }),
      })),
    ],
    [suites, findings],
  );
  const lower = needle.toLowerCase();
  const shown = commands
    .filter((command) => `${command.label} ${command.hint}`.toLowerCase().includes(lower))
    .slice(0, 40);
  const execute = async (id: string) => {
    const command = commands.find((candidate) => candidate.id === id);
    setOpen(false);
    setNeedle("");
    try {
      await command?.run();
    } catch (error) {
      toast((error as Error).message, "fail");
    }
  };
  return (
    <ModalOverlay className="overlay" isOpen={open} onOpenChange={setOpen} isDismissable>
      <Modal className="palette">
        <Dialog aria-label="Parancspaletta" className="palette-dialog">
          <Heading slot="title" className="sr-only">
            Parancspaletta
          </Heading>
          <SearchField
            className="palette-search"
            value={needle}
            onChange={setNeedle}
            aria-label="Parancs keresése"
            autoFocus
            onKeyDown={(event) => {
              if (event.key === "Enter" && shown[0]) void execute(shown[0].id);
            }}
          >
            <Search />
            <Input
              className="input"
              placeholder="Parancs, csomag vagy találat… (Enter: az első futtatása)"
            />
          </SearchField>
          <ListBox
            className="palette-list"
            aria-label="Parancsok"
            items={shown}
            onAction={(key) => void execute(String(key))}
            renderEmptyState={() => <p className="muted small">Nincs ilyen parancs.</p>}
          >
            {(command) => (
              <ListBoxItem id={command.id} className="palette-item" textValue={command.label}>
                <span>{command.label}</span>
                <span className="muted small">{command.hint}</span>
              </ListBoxItem>
            )}
          </ListBox>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
