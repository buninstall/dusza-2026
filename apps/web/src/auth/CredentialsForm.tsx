import { type FormEvent, useState } from "react";
import { Notice } from "../components/Notice.tsx";
import { Button } from "../components/ui/Button.tsx";
import { Form } from "../components/ui/Form.tsx";
import { TextField } from "../components/ui/TextField.tsx";
import { hu } from "../i18n/hu.ts";

export type Credentials = { username: string; password: string };

const USERNAME = /^[A-Za-z0-9_]{3,24}$/;
const MIN_PASSWORD = 8;

export function CredentialsForm({
  submitLabel,
  onSubmit,
  isNewAccount,
}: {
  submitLabel: string;
  onSubmit: (credentials: Credentials) => Promise<void>;
  isNewAccount: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const credentials = {
      username: String(data.get("username") ?? ""),
      password: String(data.get("password") ?? ""),
    };
    setPending(true);
    setError(null);
    try {
      await onSubmit(credentials);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : hu.app.unexpected);
    } finally {
      setPending(false);
    }
  };

  return (
    <Form onSubmit={(event) => void handleSubmit(event)}>
      {error ? <Notice tone="error" title={error} /> : null}
      <TextField
        name="username"
        label={hu.auth.username}
        autoComplete="username"
        isRequired
        validate={(value) => (USERNAME.test(value) ? null : hu.auth.usernameInvalid)}
        {...(isNewAccount ? { description: hu.auth.usernameHelp } : {})}
      />
      <TextField
        name="password"
        type="password"
        label={hu.auth.password}
        autoComplete={isNewAccount ? "new-password" : "current-password"}
        isRequired
        validate={(value) => (value.length >= MIN_PASSWORD ? null : hu.auth.passwordInvalid)}
        {...(isNewAccount ? { description: hu.auth.passwordHelp } : {})}
      />
      <Button type="submit" variant="primary" isPending={pending} className="mt-2">
        {submitLabel}
      </Button>
    </Form>
  );
}
