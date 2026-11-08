import { type ReactNode, useRef } from "react";
import { useDocumentTitle } from "../components/LocationPlate.tsx";
import { DesktopPlate } from "../desktop/DesktopPlate.tsx";
import { Logo } from "../pixel/Logo.tsx";
import { Sign } from "../pixel/PixelText.tsx";
import { LampScene } from "./LampScene.tsx";
import "./AuthScreen.css";

type AuthScreenProps = { title: string; children: ReactNode; footer: ReactNode };

export function AuthScreen({ title, children, footer }: AuthScreenProps) {
  useDocumentTitle();
  const panelRef = useRef<HTMLElement>(null);
  return (
    <main id="main" tabIndex={-1} className="auth" data-theme="tarna">
      <LampScene panelRef={panelRef} />
      <section ref={panelRef} aria-labelledby="auth-title" className="auth-console">
        <div className="auth-console-body">
          <span className="auth-logo" data-size="lg" aria-hidden="true">
            <Logo scale={4} lamp="idle" />
          </span>
          <span className="auth-logo" data-size="sm" aria-hidden="true">
            <Logo scale={2} lamp="idle" />
          </span>
          <h1 id="auth-title" className="auth-title">
            <Sign text={title} scale={3} />
          </h1>
          {children}
          <div className="auth-footer">{footer}</div>
        </div>
      </section>
      <DesktopPlate />
    </main>
  );
}
