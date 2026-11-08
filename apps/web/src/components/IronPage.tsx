import { clsx } from "clsx";
import type { ReactNode } from "react";
import "./IronPage.css";

type IronPageProps = { className?: string; children: ReactNode };

export function IronPage({ className, children }: IronPageProps) {
  return (
    <div className={clsx("iron-page", className)} data-theme="tarna" data-skin="akna">
      {children}
    </div>
  );
}

export function IronPanel({ className, children }: IronPageProps) {
  return <div className={clsx("k-panel", "iron-panel", className)}>{children}</div>;
}
