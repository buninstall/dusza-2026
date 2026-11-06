import { type ErrorComponentProps, useRouter } from "@tanstack/react-router";
import { Button } from "../components/ui/Button.tsx";
import { Link } from "../components/ui/Link.tsx";
import { hu } from "../i18n/hu.ts";
import { errorMessage } from "../lib/api.ts";
import { HazardStripe } from "../pixel/HazardStripe.tsx";
import "./StatusScreens.css";

export function Loading({ label = hu.common.loading }: { label?: string }) {
  return (
    <output className="status-loading">
      <span aria-hidden="true" className="status-loading-lamp" />
      {label}
    </output>
  );
}

export function NotFound() {
  return (
    <main id="main" tabIndex={-1} className="status">
      <div className="status-sign">
        <HazardStripe />
        <div className="status-sign-body">
          <p className="status-eyebrow">{hu.app.notFoundEyebrow}</p>
          <h1 className="status-title">{hu.app.notFoundTitle}</h1>
          <p className="status-body">{hu.app.notFoundBody}</p>
          <Link to="/maps" variant="primary" icon="grid">
            {hu.app.backToMaps}
          </Link>
        </div>
        <HazardStripe />
      </div>
    </main>
  );
}

export function RouteError({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  return (
    <main id="main" tabIndex={-1} className="status">
      <div className="status-sign" role="alert">
        <HazardStripe />
        <div className="status-sign-body">
          <p className="status-eyebrow">{hu.app.errorEyebrow}</p>
          <h1 className="status-title">{errorMessage(error, hu.app.unexpected)}</h1>
          <Button
            variant="primary"
            icon="rewind"
            onPress={() => {
              reset();
              void router.invalidate();
            }}
          >
            {hu.app.retry}
          </Button>
        </div>
        <HazardStripe />
      </div>
    </main>
  );
}
