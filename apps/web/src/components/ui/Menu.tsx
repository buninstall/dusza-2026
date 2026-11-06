import type { ReactNode } from "react";
import {
  Menu as AriaMenu,
  MenuItem as AriaMenuItem,
  type MenuItemProps,
  MenuTrigger,
  Popover,
  Separator,
} from "react-aria-components";
import type { IconName } from "../../pixel/icons.ts";
import { Button, type ButtonVariant } from "./Button.tsx";
import "./Overlay.css";

type MenuProps = {
  label: ReactNode;
  ariaLabel: string;
  icon?: IconName;
  variant?: ButtonVariant;
  isDisabled?: boolean;
  placement?: "bottom start" | "bottom end";
  children: ReactNode;
};

export function Menu({
  label,
  ariaLabel,
  icon,
  variant = "ghost",
  isDisabled = false,
  placement = "bottom end",
  children,
}: MenuProps) {
  return (
    <MenuTrigger>
      <Button
        variant={variant}
        size="sm"
        icon={icon}
        aria-label={ariaLabel}
        isDisabled={isDisabled}
      >
        {label}
      </Button>
      <Popover placement={placement} className="overlay-menu-popover">
        <AriaMenu className="overlay-menu">{children}</AriaMenu>
      </Popover>
    </MenuTrigger>
  );
}

export function MenuItem(props: Omit<MenuItemProps, "className">) {
  return <AriaMenuItem {...props} className="overlay-menu-item" />;
}

export function MenuSeparator() {
  return <Separator className="overlay-menu-separator" />;
}
