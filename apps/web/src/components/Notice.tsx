import type { ReactNode } from "react";
import type { IconName } from "../pixel/icons.ts";
import { PixelIcon } from "../pixel/PixelIcon.tsx";
import "./Notice.css";

export type NoticeTone = "error" | "success" | "info" | "warning";

const TONE_ICON: Record<NoticeTone, IconName> = {
  error: "error",
  success: "check",
  info: "book",
  warning: "warning",
};

type NoticeProps = {
  tone: NoticeTone;
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
  live?: "alert" | "status" | "none";
};

export function Notice({ tone, title, children, actions, live = "none" }: NoticeProps) {
  const role = live === "none" ? undefined : live;
  return (
    <div role={role} className="notice" data-tone={tone}>
      <span className="notice-icon">
        <PixelIcon name={TONE_ICON[tone]} />
      </span>
      <div className="notice-content">
        <p className="notice-title">{title}</p>
        {children ? <div className="notice-body">{children}</div> : null}
        {actions ? <div className="notice-actions">{actions}</div> : null}
      </div>
    </div>
  );
}
