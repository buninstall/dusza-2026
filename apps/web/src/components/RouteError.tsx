import { type ErrorComponentProps, useRouter } from "@tanstack/react-router";
import { hu } from "../i18n/hu.ts";
import { errorMessage } from "../lib/api.ts";
import { Notice } from "./Notice.tsx";
import { Button } from "./ui/Button.tsx";

export function RouteError({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  return (
    <main
      id="main"
      tabIndex={-1}
      className="mx-auto flex max-w-xl flex-col gap-4 px-6 py-24 outline-none"
    >
      <Notice tone="error" title={errorMessage(error, hu.app.unexpected)} />
      <Button
        variant="primary"
        onPress={() => {
          reset();
          void router.invalidate();
        }}
        className="self-start"
      >
        {hu.app.retry}
      </Button>
    </main>
  );
}
