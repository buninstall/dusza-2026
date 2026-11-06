import type { ReactNode } from "react";
import { Switch as AriaSwitch, type SwitchProps as AriaSwitchProps } from "react-aria-components";

type SwitchProps = Omit<AriaSwitchProps, "children"> & { children: ReactNode };

export function Switch({ children, ...props }: SwitchProps) {
  return (
    <AriaSwitch {...props} className="group flex items-center gap-2 text-sm text-ink outline-none">
      <span className="flex h-6 w-10 items-center rounded-full border border-line-strong bg-paper-sunken px-0.5 transition-colors group-data-[selected]:bg-ink group-data-[focus-visible]:outline-3 group-data-[focus-visible]:outline-offset-2 group-data-[focus-visible]:outline-lamp">
        <span className="size-4.5 rounded-full bg-paper-raised shadow transition-transform duration-150 group-data-[selected]:translate-x-4 group-data-[selected]:bg-ore" />
      </span>
      {children}
    </AriaSwitch>
  );
}
