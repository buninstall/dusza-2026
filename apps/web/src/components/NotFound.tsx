import { hu } from "../i18n/hu.ts";
import { Link } from "./ui/Link.tsx";

export function NotFound() {
  return (
    <main id="main" tabIndex={-1} className="mx-auto max-w-xl px-6 py-24 outline-none">
      <p className="eyebrow">404</p>
      <h1 className="mt-2 text-4xl font-black tracking-tighter">{hu.app.notFoundTitle}</h1>
      <p className="mt-3 text-ink-muted">{hu.app.notFoundBody}</p>
      <Link to="/maps" variant="primary" className="mt-6">
        {hu.app.backToMaps}
      </Link>
    </main>
  );
}
