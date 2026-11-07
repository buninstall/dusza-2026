import "@fontsource-variable/atkinson-hyperlegible-next";
import "@fontsource-variable/pixelify-sans";
import "./styles.css";
import { StrictMode, useEffect, useRef, useState } from "react";
import { Button, FieldError, Form, Input, Label, TextField } from "react-aria-components";
import { createRoot } from "react-dom/client";
import { Lamp } from "./icons.tsx";

function Login() {
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [lockedFor, setLockedFor] = useState(0);
  const field = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (lockedFor <= 0) return;
    const timer = setTimeout(() => setLockedFor(lockedFor - 1), 1000);
    return () => clearTimeout(timer);
  }, [lockedFor]);
  const submit = async () => {
    if (!password) {
      setMessage("Add meg a jelszót.");
      field.current?.focus();
      return;
    }
    setBusy(true);
    setMessage("Ellenőrzés…");
    try {
      const response = await fetch("/api/login", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        retryAfterSeconds?: number;
      };
      setPassword("");
      if (response.ok) {
        setMessage("Sikeres belépés, a konzol betöltődik…");
        window.location.replace("/");
        return;
      }
      if (data.retryAfterSeconds && data.retryAfterSeconds > 0)
        setLockedFor(data.retryAfterSeconds);
      setMessage(data.error ?? "A belépés nem sikerült.");
      field.current?.focus();
    } catch {
      setMessage("A konzol nem érhető el.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="login">
      <div className="login-shaft" aria-hidden="true">
        {Array.from({ length: 14 }, (_, index) => (
          <span key={index} style={{ animationDelay: `${index * 0.17}s` }} />
        ))}
      </div>
      <section className="login-card" aria-labelledby="login-title">
        <p className="brand big">
          <Lamp size={28} />
          <span className="brand-word">TESZTAKNA</span>
        </p>
        <h1 id="login-title">MineScript tesztkonzol</h1>
        <p className="muted">
          A konzol parancsokat futtat ezen a gépen, ezért csak a helyes jelszóval lehet belépni.
        </p>
        <Form
          className="stack"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <TextField
            className="field"
            type="password"
            value={password}
            onChange={setPassword}
            isRequired
            autoComplete="current-password"
            maxLength={256}
          >
            <Label>Jelszó</Label>
            <Input className="input large" ref={field} />
            <FieldError className="error-text" />
          </TextField>
          <Button type="submit" className="button primary large" isDisabled={busy || lockedFor > 0}>
            {lockedFor > 0
              ? `Zárolva még ${lockedFor} mp`
              : busy
                ? "Ellenőrzés…"
                : "Belépés a tárnába"}
          </Button>
          <p className="login-message" role="alert">
            {lockedFor > 0
              ? `Túl sok sikertelen próbálkozás. Újra próbálkozhatsz ${lockedFor} másodperc múlva.`
              : message}
          </p>
        </Form>
      </section>
    </main>
  );
}

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <Login />
    </StrictMode>,
  );
}
