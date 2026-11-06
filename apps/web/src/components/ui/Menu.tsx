import { clsx } from "clsx";
import type { ReactNode } from "react";
import {
  Menu as AriaMenu,
  MenuItem as AriaMenuItem,
  type MenuItemProps,
  MenuTrigger,
  Popover,
} from "react-aria-components";
import { Button } from "./Button.tsx";

type MenuProps = {
  label: ReactNode;
  ariaLabel: string;
  children: ReactNode;
};

export function Menu({ label, ariaLabel, children }: MenuProps) {
  return (
    <MenuTrigger>
      <Button variant="ghost" size="sm" aria-label={ariaLabel}>
        {label}
      </Button>
      <Popover
        placement="bottom end"
        className="plate min-w-48 p-1 outline-none data-[entering]:animate-in"
      >
        <AriaMenu className="outline-none">{children}</AriaMenu>
      </Popover>
    </MenuTrigger>
  );
}

export function MenuItem({ className, ...props }: MenuItemProps) {
  return (
    <AriaMenuItem
      {...props}
      className={clsx(
        "flex cursor-default items-center gap-2 rounded-[8px] px-3 py-2 text-sm text-ink outline-none data-[focused]:bg-paper-sunken data-[disabled]:text-ink-muted",
        typeof className === "string" ? className : null,
      )}
    />
  );
}
