import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { AuthScreen } from "../auth/AuthScreen.tsx";
import { CredentialsForm } from "../auth/CredentialsForm.tsx";
import { safeRedirect, sessionQuery } from "../auth/session.ts";
import { Link } from "../components/ui/Link.tsx";
import { hu } from "../i18n/hu.ts";
import { api, call } from "../lib/api.ts";

const searchSchema = z.object({ redirect: z.string().optional() });

function LoginPage() {
  const { redirect } = Route.useSearch();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return (
    <AuthScreen
      title={hu.auth.loginTitle}
      footer={<Link to="/register">{hu.auth.toRegister}</Link>}
    >
      <CredentialsForm
        isNewAccount={false}
        submitLabel={hu.auth.submitLogin}
        onSubmit={async (credentials) => {
          const { user } = await call(api.auth.login.$post({ json: credentials }));
          queryClient.setQueryData(sessionQuery.queryKey, user);
          await navigate({ to: safeRedirect(redirect) });
        }}
      />
    </AuthScreen>
  );
}

export const Route = createFileRoute("/login")({
  validateSearch: searchSchema,
  component: LoginPage,
});
