import { Dialog, DialogTrigger, Heading, Popover } from "react-aria-components";
import { IconButton } from "../../components/ui/IconButton.tsx";
import { hu } from "../../i18n/hu.ts";

export type ShortcutRow = { readonly keys: readonly string[]; readonly action: string };

export function KeysPopover({ rows }: { rows: readonly ShortcutRow[] }) {
  return (
    <DialogTrigger>
      <IconButton icon="key" label={hu.play.keys} variant="ghost" />
      <Popover placement="bottom end" className="overlay-popover">
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
