import { clsx } from "clsx";
import { type ReactNode, useId } from "react";
import { PixelText } from "../pixel/PixelText.tsx";
import "./Panel.css";

type PanelProps = {
  title: string;
  titleMeta?: ReactNode;
  headingLevel?: 2 | 3;
  actions?: ReactNode;
  tone?: "plate" | "screen";
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
};

export function Panel({
  title,
  titleMeta,
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
          <PixelText text={title} scale={2} />
          <span className="visually-hidden">{title}</span>
        </Heading>
        {titleMeta ? <span className="panel-title-meta">{titleMeta}</span> : null}
        {actions ? <div className="panel-actions">{actions}</div> : null}
      </header>
      <div className={clsx("panel-body", bodyClassName)}>{children}</div>
    </section>
  );
}
