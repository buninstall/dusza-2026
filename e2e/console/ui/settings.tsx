import { useState } from "react";
import { Button, Form, Input, Label, NumberField, Switch, TextField } from "react-aria-components";
import { api } from "./api.ts";
import { Panel, toast } from "./components.tsx";
import { useLive } from "./state.ts";

export function notificationsEnabled(): boolean {
  try {
    return (
      localStorage.getItem("tc-notify") === "1" &&
      "Notification" in window &&
      Notification.permission === "granted"
    );
  } catch {
    return false;
  }
}

export function Settings() {
  const { settings, dataDir } = useLive();
  const [baseUrl, setBaseUrl] = useState(settings.baseUrl);
  const [timeout, setTimeoutMinutes] = useState(settings.timeoutMinutes);
  const [notify, setNotify] = useState(notificationsEnabled());
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem("tc-theme") ?? "mine";
    } catch {
      return "mine";
    }
  });
  const save = async () => {
    try {
      await api("/api/settings", { method: "POST", body: { baseUrl, timeoutMinutes: timeout } });
      await useLive.getState().load();
      toast("Beállítások mentve.", "ok");
    } catch (error) {
      toast((error as Error).message, "fail");
    }
  };
  const toggleNotify = async (value: boolean) => {
    if (value && "Notification" in window && Notification.permission !== "granted") {
      const permission = await Notification.requestPermission();
      if (permission !== "granted")
        return toast("A böngésző nem engedélyezte az értesítéseket.", "fail");
    }
    try {
      localStorage.setItem("tc-notify", value ? "1" : "0");
    } catch {
      return;
    }
    setNotify(value);
  };
  const toggleTheme = (light: boolean) => {
    const next = light ? "daylight" : "mine";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("tc-theme", next);
    } catch {
      return;
    }
    setTheme(next);
  };
  return (
    <div className="page narrow">
      <div className="page-head">
        <div>
          <p className="eyebrow">Gépház</p>
          <h1>Beállítások</h1>
        </div>
      </div>
      <Panel title="Futtatás">
        <Form
          className="stack"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <TextField className="field" value={baseUrl} onChange={setBaseUrl} isRequired type="url">
            <Label>Élő vizsgálatok célpéldánya (csak helyi cím)</Label>
            <Input className="input" />
          </TextField>
          <NumberField
            className="field"
            value={timeout}
            onChange={setTimeoutMinutes}
            minValue={1}
            maxValue={240}
          >
            <Label>Időkorlát csomagonként (perc)</Label>
            <Input className="input" />
          </NumberField>
          <Button type="submit" className="button primary">
            Mentés
          </Button>
        </Form>
      </Panel>
      <Panel title="Felület">
        <div className="stack">
          <Switch
            className="switch"
            isSelected={notify}
            onChange={(value) => void toggleNotify(value)}
          >
            <span className="switch-track" aria-hidden="true" />
            Asztali értesítés, ha egy futás véget ér
          </Switch>
          <Switch className="switch" isSelected={theme === "daylight"} onChange={toggleTheme}>
            <span className="switch-track" aria-hidden="true" />
            Világos téma
          </Switch>
        </div>
      </Panel>
      <Panel title="Adatok">
        <p className="muted">
          A futások, a naplók, a találatok és a jelszó hashe a repón kívül, ebben a mappában vannak:
        </p>
        <p className="mono">{dataDir}</p>
      </Panel>
    </div>
  );
}
