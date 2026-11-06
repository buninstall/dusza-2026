import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AuthLayout } from "../auth/AuthLayout.tsx";
import { CredentialsForm } from "../auth/CredentialsForm.tsx";
import { sessionQuery } from "../auth/session.ts";
import { Link } from "../components/ui/Link.tsx";
import { hu } from "../i18n/hu.ts";
import { api, call } from "../lib/api.ts";

function RegisterPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return (
    <AuthLayout title={hu.auth.registerTitle} lead={hu.auth.registerLead}>
      <CredentialsForm
        isNewAccount
        submitLabel={hu.auth.submitRegister}
        onSubmit={async (credentials) => {
          const { user } = await call(api.auth.register.$post({ json: credentials }));
          queryClient.setQueryData(sessionQuery.queryKey, user);
          await navigate({ to: "/maps" });
        }}
      />
      <p className="mt-6 text-sm">
        <Link to="/login">{hu.auth.toLogin}</Link>
      </p>
    </AuthLayout>
  );
}

export const Route = createFileRoute("/register")({
  component: RegisterPage,
});
