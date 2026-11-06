import { clsx } from "clsx";
import {
  Button as AriaButton,
  type ButtonProps as AriaButtonProps,
  composeRenderProps,
} from "react-aria-components";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

export const buttonBase =
  "inline-flex select-none items-center justify-center gap-2 rounded-[10px] font-semibold transition-[background-color,box-shadow,transform] duration-150 ease-out outline-none data-[focus-visible]:outline-3 data-[focus-visible]:outline-offset-2 data-[focus-visible]:outline-lamp data-[pressed]:translate-y-px data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50";

export const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    "bg-ink text-paper shadow-[inset_0_-2px_0_var(--ore)] data-[hovered]:bg-[color-mix(in_oklch,var(--ink)_88%,var(--ore))]",
  secondary:
    "border border-line-strong bg-paper-raised text-ink data-[hovered]:border-ink data-[hovered]:bg-paper",
  ghost: "text-ink-muted data-[hovered]:bg-paper-sunken data-[hovered]:text-ink",
  danger: "bg-rust text-paper-raised data-[hovered]:brightness-110",
};

export const buttonSizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-[0.95rem]",
};

export type ButtonProps = AriaButtonProps & { variant?: ButtonVariant; size?: ButtonSize };

export function Button({ variant = "secondary", size = "md", className, ...props }: ButtonProps) {
  return (
    <AriaButton
      {...props}
      className={composeRenderProps(className, (custom) =>
        clsx(buttonBase, buttonVariants[variant], buttonSizes[size], custom),
      )}
    />
  );
}
