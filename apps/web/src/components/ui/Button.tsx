import { clsx } from "clsx";
import type { ReactNode } from "react";
import {
  Button as AriaButton,
  type ButtonProps as AriaButtonProps,
  composeRenderProps,
} from "react-aria-components";
import type { IconName } from "../../pixel/icons.ts";
import { PixelIcon } from "../../pixel/PixelIcon.tsx";
import "./Button.css";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

export type ButtonLookProps = {
  variant?: ButtonVariant | undefined;
  size?: ButtonSize | undefined;
  icon?: IconName | undefined;
};

export function buttonLook(variant: ButtonVariant | undefined, size: ButtonSize | undefined) {
  return { "data-variant": variant ?? "secondary", "data-size": size ?? "md" };
}

type ButtonContentProps = { icon?: IconName | undefined; children?: ReactNode };

export function ButtonContent({ icon, children }: ButtonContentProps) {
  return (
    <>
      {icon ? <PixelIcon name={icon} /> : null}
      {children}
    </>
  );
}

type ButtonProps = Omit<AriaButtonProps, "children"> &
  ButtonLookProps & { children?: ReactNode; className?: string | undefined };

export function Button({ variant, size, icon, children, className, ...props }: ButtonProps) {
  const isIconOnly = children === undefined && icon !== undefined;
  return (
    <AriaButton
      {...props}
      {...buttonLook(variant, size)}
      className={composeRenderProps(className, (custom) =>
        clsx("btn", isIconOnly && "btn-icon-only", custom),
      )}
    >
      <ButtonContent icon={icon}>{children}</ButtonContent>
    </AriaButton>
  );
}
