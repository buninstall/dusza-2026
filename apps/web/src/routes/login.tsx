import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { AuthLayout } from "../auth/AuthLayout.tsx";
import { CredentialsForm } from "../auth/CredentialsForm.tsx";
import { sessionQuery } from "../auth/session.ts";
import { Link } from "../components/ui/Link.tsx";
import { hu } from "../i18n/hu.ts";
import { api, call } from "../lib/api.ts";

const searchSchema = z.object({ redirect: z.string().optional() });

function safeRedirect(target: string | undefined): string {
  return target?.startsWith("/") && !target.startsWith("//") ? target : "/maps";
}

function LoginPage() {
  const { redirect } = Route.useSearch();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return (
    <AuthLayout title={hu.auth.loginTitle} lead={hu.auth.loginLead}>
      <CredentialsForm
        isNewAccount={false}
        submitLabel={hu.auth.submitLogin}
        onSubmit={async (credentials) => {
          const { user } = await call(api.auth.login.$post({ json: credentials }));
          queryClient.setQueryData(sessionQuery.queryKey, user);
          await navigate({ to: safeRedirect(redirect) });
        }}
      />
      <p className="mt-6 text-sm">
        <Link to="/register">{hu.auth.toRegister}</Link>
      </p>
      <p className="mt-4 font-mono text-xs text-ink-muted">{hu.auth.demoHint}</p>
    </AuthLayout>
  );
}

export const Route = createFileRoute("/login")({
  validateSearch: searchSchema,
  component: LoginPage,
});
