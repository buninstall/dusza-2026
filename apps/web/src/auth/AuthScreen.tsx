import type { ReactNode } from "react";
import { useDocumentTitle } from "../components/LocationPlate.tsx";
import { HazardStripe } from "../pixel/HazardStripe.tsx";
import { Logo } from "../pixel/Logo.tsx";
import { PixelText } from "../pixel/PixelText.tsx";
import { AttractScene } from "./AttractScene.tsx";
import "./AuthScreen.css";

type AuthScreenProps = { plate: string; title: string; children: ReactNode; footer: ReactNode };

export function AuthScreen({ plate, title, children, footer }: AuthScreenProps) {
  useDocumentTitle(title);
  return (
    <main id="main" tabIndex={-1} className="auth">
      <section aria-labelledby="auth-title" className="auth-console">
        <HazardStripe />
        <div className="auth-console-body">
          <h1 id="auth-title" className="visually-hidden">
            {title}
          </h1>
          <span aria-hidden="true" className="auth-plate">
            <PixelText text={plate} scale={4} />
          </span>
          {children}
          <div className="auth-footer">{footer}</div>
        </div>
      </section>
      <div className="auth-showcase">
        <span className="auth-logo" data-size="lg">
          <Logo scale={4} lamp="idle" />
        </span>
        <span className="auth-logo" data-size="sm">
          <Logo scale={2} lamp="idle" />
        </span>
        <AttractScene />
      </div>
    </main>
  );
}
