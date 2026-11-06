import type { ReactElement, ReactNode } from "react";
import { Tooltip as AriaTooltip, TooltipTrigger } from "react-aria-components";

type TooltipProps = { content: ReactNode; children: ReactElement };

export function Tooltip({ content, children }: TooltipProps) {
  return (
    <TooltipTrigger delay={400}>
      {children}
      <AriaTooltip
        offset={6}
        className="rounded-[8px] bg-ink px-2.5 py-1.5 text-xs font-medium text-paper shadow-lg"
      >
        {content}
      </AriaTooltip>
    </TooltipTrigger>
  );
}
