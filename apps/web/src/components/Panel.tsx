import { clsx } from "clsx";
import { type ReactNode, useId } from "react";
import "./Panel.css";

type PanelProps = {
  title: ReactNode;
  headingLevel?: 2 | 3;
  actions?: ReactNode;
  tone?: "plate" | "screen";
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
};

export function Panel({
  title,
  headingLevel = 2,
  actions,
  tone = "plate",
  className,
  bodyClassName,
  children,
}: PanelProps) {
  const headingId = useId();
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <section aria-labelledby={headingId} className={clsx("panel", className)} data-tone={tone}>
      <header className="panel-head">
        <Heading id={headingId} className="panel-title">
          {title}
        </Heading>
        {actions ? <div className="panel-actions">{actions}</div> : null}
      </header>
      <div className={clsx("panel-body", bodyClassName)}>{children}</div>
    </section>
  );
}
