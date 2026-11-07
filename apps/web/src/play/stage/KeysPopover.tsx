import {
  Dialog,
  DialogTrigger,
  Heading,
  Popover,
  type PopoverProps,
} from "react-aria-components";
import { type ButtonVariant } from "../../components/ui/Button.tsx";
import { IconButton } from "../../components/ui/IconButton.tsx";
import { hu } from "../../i18n/hu.ts";

export type ShortcutRow = { readonly keys: readonly string[]; readonly action: string };

type KeysPopoverProps = {
  rows: readonly ShortcutRow[];
  placement?: PopoverProps["placement"];
  variant?: ButtonVariant;
};

export function KeysPopover({ rows, placement = "bottom end", variant = "ghost" }: KeysPopoverProps) {
  return (
    <DialogTrigger>
      <IconButton icon="key" label={hu.play.keys} variant={variant} />
      <Popover placement={placement} className="overlay-popover">
        <Dialog className="overlay-popover-dialog">
          <Heading slot="title" className="overlay-title">
            {hu.play.keysTitle}
          </Heading>
          <dl className="dl-keys">
            {rows.map((row) => (
              <div key={row.action} className="dl-keys-row">
                <dt>
                  {row.keys.map((key) => (
                    <kbd key={key}>{key}</kbd>
                  ))}
                </dt>
                <dd>{row.action}</dd>
              </div>
            ))}
          </dl>
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
}
