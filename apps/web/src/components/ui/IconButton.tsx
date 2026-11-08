import type { Ref } from "react";
import {
  type ButtonProps as AriaButtonProps,
  Tooltip,
  TooltipTrigger,
} from "react-aria-components";
import type { IconName } from "../../pixel/icons.ts";
import { Button, type ButtonSize, type ButtonVariant } from "./Button.tsx";
import { OVERLAY_SKIN } from "./overlay-skin.ts";
import "./Overlay.css";

type IconButtonProps = Omit<AriaButtonProps, "children" | "aria-label" | "className"> & {
  icon: IconName;
  label: string;
  tooltip?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  ref?: Ref<HTMLButtonElement>;
};

export function IconButton({
  icon,
  label,
  tooltip,
  variant = "secondary",
  ...props
}: IconButtonProps) {
  return (
    <TooltipTrigger delay={400} closeDelay={0}>
      <Button {...props} variant={variant} icon={icon} aria-label={label} />
      <Tooltip className="overlay-tooltip" offset={6} {...OVERLAY_SKIN}>
        {tooltip ?? label}
      </Tooltip>
    </TooltipTrigger>
  );
}
