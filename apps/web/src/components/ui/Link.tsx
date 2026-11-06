import { createLink, type LinkComponent } from "@tanstack/react-router";
import { clsx } from "clsx";
import { forwardRef } from "react";
import {
  Link as AriaLink,
  type LinkProps as AriaLinkProps,
  composeRenderProps,
} from "react-aria-components";
import {
  type ButtonSize,
  type ButtonVariant,
  buttonBase,
  buttonSizes,
  buttonVariants,
} from "./Button.tsx";

type AriaLinkBaseProps = Omit<AriaLinkProps, "href"> & {
  variant?: ButtonVariant | "text" | "plain";
  size?: ButtonSize;
};

const linkPlain =
  "no-underline outline-none rounded-sm data-[focus-visible]:outline-3 data-[focus-visible]:outline-lamp";

const linkText =
  "font-semibold text-ink underline decoration-ore decoration-2 underline-offset-4 outline-none data-[hovered]:decoration-ink data-[focus-visible]:outline-3 data-[focus-visible]:outline-lamp rounded-sm";

const AriaLinkBase = forwardRef<HTMLAnchorElement, AriaLinkBaseProps>(
  ({ variant = "text", size = "md", className, ...props }, ref) => (
    <AriaLink
      {...props}
      ref={ref}
      className={composeRenderProps(className, (custom) =>
        variant === "text"
          ? clsx(linkText, custom)
          : variant === "plain"
            ? clsx(linkPlain, custom)
            : clsx(buttonBase, buttonVariants[variant], buttonSizes[size], custom),
      )}
    />
  ),
);
AriaLinkBase.displayName = "AriaLinkBase";

const RouterLink = createLink(AriaLinkBase);

export const Link: LinkComponent<typeof AriaLinkBase> = (props) => (
  <RouterLink preload="intent" {...props} />
);
