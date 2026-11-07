import { type FormEvent, useState } from "react";
import { DialogTrigger, Form } from "react-aria-components";
import { passwordProblem, usernameProblem } from "../auth/credentials.ts";
import { Notice } from "../components/Notice.tsx";
import { Button } from "../components/ui/Button.tsx";
import { ModalShell } from "../components/ui/Dialog.tsx";
import { Segmented } from "../components/ui/Segmented.tsx";
import { TextField } from "../components/ui/TextField.tsx";
import { hu } from "../i18n/hu.ts";
import { errorMessage } from "../lib/api.ts";

type AccountRole = "admin" | "user";

export type NewAccount = { username: string; password: string; role: AccountRole };

const EMPTY: NewAccount = { username: "", password: "", role: "user" };

const ROLE_OPTIONS = [
  { id: "user", label: hu.admin.roleUser, icon: "helmet" },
  { id: "admin", label: hu.admin.roleAdmin, icon: "key" },
] as const;

function NewAccountForm({
  onCreate,
  close,
}: {
  onCreate: (account: NewAccount) => Promise<void>;
  close: () => void;
}) {
  const [values, setValues] = useState<NewAccount>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setPending] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await onCreate(values);
      close();
    } catch (caught) {
      setError(errorMessage(caught, hu.app.unexpected));
    } finally {
      setPending(false);
    }
  };

  return (
    <Form className="admin-new-form" onSubmit={(event) => void handleSubmit(event)}>
      {error ? <Notice tone="error" title={error} live="alert" /> : null}
      <TextField
        name="username"
        label={hu.auth.username}
        autoComplete="off"
        isRequired
        autoFocus
        value={values.username}
        onChange={(username) => setValues((current) => ({ ...current, username }))}
        validate={usernameProblem}
        description={hu.auth.usernameHelp}
      />
      <TextField
        name="password"
        type="password"
        label={hu.auth.password}
        autoComplete="new-password"
        isRequired
        value={values.password}
        onChange={(password) => setValues((current) => ({ ...current, password }))}
        validate={passwordProblem}
        description={hu.auth.passwordHelp}
      />
      <Segmented
        label={hu.admin.role}
        value={values.role}
        options={ROLE_OPTIONS}
        onChange={(role) => setValues((current) => ({ ...current, role }))}
      />
      <div className="overlay-actions">
        <Button onPress={close}>{hu.common.cancel}</Button>
        <Button type="submit" variant="primary" icon="plus" isPending={isPending}>
          {hu.admin.createSubmit}
        </Button>
      </div>
    </Form>
  );
}

export function NewAccountDialog({
  onCreate,
}: {
  onCreate: (account: NewAccount) => Promise<void>;
}) {
  return (
    <DialogTrigger>
      <Button variant="primary" size="sm" icon="plus">
        {hu.admin.create}
      </Button>
      <ModalShell title={hu.admin.createTitle}>
        {(close) => <NewAccountForm onCreate={onCreate} close={close} />}
      </ModalShell>
    </DialogTrigger>
  );
}
