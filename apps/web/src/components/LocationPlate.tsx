import { clsx } from "clsx";
import { type ReactNode, useEffect } from "react";
import { hu } from "../i18n/hu.ts";
import { PixelText } from "../pixel/PixelText.tsx";
import "./LocationPlate.css";

type LocationPlateProps = {
  name: string;
  detail?: string | undefined;
  headingPrefix?: string;
  documentTitle?: string;
  meta?: ReactNode;
  lead?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  isDocked?: boolean;
  hasSign?: boolean;
  isTitleHidden?: boolean;
};

export function useDocumentTitle(title: string): void {
  useEffect(() => {
    document.title = `${title} – ${hu.app.name}`;
  }, [title]);
}

export function PlateSign({ name }: { name: string }) {
  return (
    <span aria-hidden="true" className="plate-sign">
      <PixelText text={name} scale={3} />
    </span>
  );
}

export function LocationPlate({
  name,
  detail,
  headingPrefix,
  documentTitle,
  meta,
  lead,
  actions,
  children,
  className,
  isDocked = true,
  hasSign = true,
  isTitleHidden = false,
}: LocationPlateProps) {
  useDocumentTitle(documentTitle ?? detail ?? name);
  return (
    <header className={clsx("plate", className)} data-docked={isDocked}>
      <span aria-hidden="true" className="plate-rivets" />
      {lead}
      {hasSign ? <PlateSign name={name} /> : null}
      <div className="plate-text">
        {detail === undefined ? (
          <h1 className="visually-hidden">{name}</h1>
        ) : (
          <h1 className={isTitleHidden ? "visually-hidden" : "plate-detail"}>
            {headingPrefix ? <span className="visually-hidden">{headingPrefix}</span> : null}
            {detail}
          </h1>
        )}
        {meta ? <p className="plate-meta">{meta}</p> : null}
      </div>
      {children}
      {actions ? <div className="plate-actions">{actions}</div> : null}
    </header>
  );
}
