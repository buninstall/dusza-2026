import type { ReactNode } from "react";
import { hu } from "../i18n/hu.ts";
import { HazardStripe } from "../pixel/HazardStripe.tsx";
import { Logo } from "../pixel/Logo.tsx";
import { AttractScene } from "./AttractScene.tsx";
import "./AuthScreen.css";

type AuthScreenProps = {
  eyebrow: string;
  title: string;
  lead: string;
  children: ReactNode;
  footer: ReactNode;
};

export function AuthScreen({ eyebrow, title, lead, children, footer }: AuthScreenProps) {
  return (
    <main id="main" tabIndex={-1} className="auth">
      <div className="auth-showcase">
        <Logo size="xl" />
        <p className="auth-tagline">{hu.app.tagline}</p>
        <AttractScene />
      </div>
      <section aria-labelledby="auth-title" className="auth-console">
        <HazardStripe />
        <div className="auth-console-body">
          <p className="auth-eyebrow">{eyebrow}</p>
          <h1 id="auth-title" className="auth-title">
            {title}
          </h1>
          <p className="auth-lead">{lead}</p>
          {children}
          <div className="auth-footer">{footer}</div>
        </div>
      </section>
    </main>
  );
}

export function DemoAccounts() {
  return (
    <aside aria-labelledby="demo-title" className="auth-demo">
      <h2 id="demo-title" className="auth-demo-title">
        {hu.auth.demoTitle}
      </h2>
      <dl className="auth-demo-list">
        {hu.auth.demoAccounts.map((account) => (
          <div key={account.username}>
            <dt>{account.role}</dt>
            <dd>
              <code>{account.username}</code> / <code>{account.password}</code>
            </dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}
