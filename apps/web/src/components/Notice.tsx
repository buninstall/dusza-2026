import { clsx } from "clsx";
import type { ReactNode } from "react";

type NoticeTone = "error" | "success" | "info";

const toneClass: Record<NoticeTone, string> = {
  error: "border-rust bg-rust-soft text-ink",
  success: "border-moss bg-moss-soft text-ink",
  info: "border-line-strong bg-paper-sunken text-ink",
};

export function Notice({
  tone,
  title,
  children,
}: {
  tone: NoticeTone;
  title?: string;
  children?: ReactNode;
}) {
  return (
    <div
      role={tone === "error" ? "alert" : undefined}
      className={clsx("rounded-[12px] border-l-4 px-4 py-3 text-sm", toneClass[tone])}
    >
      {title ? <p className="font-semibold">{title}</p> : null}
      {children ? <div className={clsx(title && "mt-1")}>{children}</div> : null}
    </div>
  );
}
