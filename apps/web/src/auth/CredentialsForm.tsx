import { type FormEvent, useState } from "react";
import { Form } from "react-aria-components";
import { Notice } from "../components/Notice.tsx";
import { Button } from "../components/ui/Button.tsx";
import { TextField } from "../components/ui/TextField.tsx";
import { hu } from "../i18n/hu.ts";
import { errorMessage } from "../lib/api.ts";
import "./AuthScreen.css";
import { type Credentials, passwordProblem, usernameProblem } from "./credentials.ts";

type CredentialsFormProps = {
  isNewAccount: boolean;
  submitLabel: string;
  onSubmit: (credentials: Credentials) => Promise<void>;
};

function readCredentials(form: HTMLFormElement): Credentials {
  const data = new FormData(form);
  return {
    username: String(data.get("username") ?? ""),
    password: String(data.get("password") ?? ""),
  };
}

export function CredentialsForm({ isNewAccount, submitLabel, onSubmit }: CredentialsFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, setPending] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await onSubmit(readCredentials(event.currentTarget));
    } catch (caught) {
      setError(errorMessage(caught, hu.app.unexpected));
    } finally {
      setPending(false);
    }
  };

  return (
    <Form className="auth-form" onSubmit={(event) => void handleSubmit(event)}>
      {error ? <Notice tone="error" title={error} live="alert" /> : null}
      <TextField
        name="username"
        label={hu.auth.username}
        autoComplete="username"
        isRequired
        validate={usernameProblem}
        description={isNewAccount ? hu.auth.usernameHelp : undefined}
      />
      <TextField
        name="password"
        type="password"
        label={hu.auth.password}
        autoComplete={isNewAccount ? "new-password" : "current-password"}
        isRequired
        validate={passwordProblem}
        description={isNewAccount ? hu.auth.passwordHelp : undefined}
      />
      <Button type="submit" variant="primary" isPending={isPending} icon="play">
        {submitLabel}
      </Button>
    </Form>
  );
}
