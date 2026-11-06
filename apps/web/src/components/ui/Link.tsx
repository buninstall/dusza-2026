import { createLink, type LinkComponent } from "@tanstack/react-router";
import { clsx } from "clsx";
import { forwardRef, type ReactNode } from "react";
import { Link as AriaLink, type LinkProps as AriaLinkProps } from "react-aria-components";
import type { IconName } from "../../pixel/icons.ts";
import { ButtonContent, type ButtonSize, type ButtonVariant, buttonLook } from "./Button.tsx";
import "./Button.css";

type LinkLook = ButtonVariant | "text" | "plain";

type AriaLinkBaseProps = Omit<AriaLinkProps, "href" | "children" | "className"> & {
  variant?: LinkLook | undefined;
  size?: ButtonSize | undefined;
  icon?: IconName | undefined;
  className?: string | undefined;
  children?: ReactNode;
};

const AriaLinkBase = forwardRef<HTMLAnchorElement, AriaLinkBaseProps>(
  ({ variant = "text", size, icon, className, children, ...props }, ref) => {
    if (variant === "text" || variant === "plain") {
      const look = variant === "text" ? "btn-text-link" : "btn-plain-link";
      return (
        <AriaLink {...props} ref={ref} className={clsx(look, className)}>
          <ButtonContent icon={icon}>{children}</ButtonContent>
        </AriaLink>
      );
    }
    return (
      <AriaLink
        {...props}
        {...buttonLook(variant, size)}
        ref={ref}
        className={clsx("btn", className)}
      >
        <ButtonContent icon={icon}>{children}</ButtonContent>
      </AriaLink>
    );
  },
);
AriaLinkBase.displayName = "AriaLinkBase";

const RouterLink = createLink(AriaLinkBase);

export const Link: LinkComponent<typeof AriaLinkBase> = (props) => (
  <RouterLink preload="intent" {...props} />
);
