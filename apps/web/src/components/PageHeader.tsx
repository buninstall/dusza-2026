import type { ReactNode } from "react";
import "./PageHeader.css";

type PageHeaderProps = {
  eyebrow: string;
  title: string;
  lead?: ReactNode;
  actions?: ReactNode;
};

export function PageHeader({ eyebrow, title, lead, actions }: PageHeaderProps) {
  return (
    <header className="page-header">
      <div className="page-header-text">
        <p className="page-header-eyebrow">{eyebrow}</p>
        <h1 className="page-header-title">{title}</h1>
        {lead ? <p className="page-header-lead">{lead}</p> : null}
      </div>
      {actions ? <div className="page-header-actions">{actions}</div> : null}
    </header>
  );
}
