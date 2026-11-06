import { useMemo } from "react";
import { Menu, MenuItem, MenuTrigger, Popover, Text, Toolbar } from "react-aria-components";
import { Button } from "../../components/ui/Button.tsx";
import { tokenizeLine } from "../../editor/language.ts";
import { useEngine } from "../../engine/useEngine.ts";
import { hu } from "../../i18n/hu.ts";
import type { IconName } from "../../pixel/icons.ts";
import { DRAWER_IDS, type DrawerId, usePlayUi } from "../play-ui-store.ts";
import { type Block, blocksIn, plainLines } from "./blocks.ts";

const DRAWER_ICON: Record<DrawerId, IconName> = {
  robot: "robot",
  sense: "eye",
  variables: "variable",
  decision: "branch",
  loop: "loop",
};

function CodeLines({
  lines,
  keywords,
}: {
  lines: readonly string[];
  keywords: ReadonlySet<string>;
}) {
  return (
    <code className="drawer-code">
      {lines.map((line, row) => (
        <span key={`${row.toString()}-${line}`} className="drawer-code-line">
          {tokenizeLine(line, keywords).map((token, column) => (
            <span key={`${column.toString()}-${token.text}`} data-token={token.kind ?? undefined}>
              {token.text}
            </span>
          ))}
        </span>
      ))}
    </code>
  );
}

type DrawerProps = {
  drawer: DrawerId;
  isDisabled: boolean;
  keywords: ReadonlySet<string>;
  onInsert: (block: Block) => void;
};

function Drawer({ drawer, isDisabled, keywords, onInsert }: DrawerProps) {
  const openDrawer = usePlayUi((state) => state.openDrawer);
  const setOpenDrawer = usePlayUi((state) => state.setOpenDrawer);
  return (
    <MenuTrigger
      isOpen={openDrawer === drawer}
      onOpenChange={(isOpen) => setOpenDrawer(isOpen ? drawer : null)}
    >
      <Button
        size="sm"
        icon={DRAWER_ICON[drawer]}
        isDisabled={isDisabled}
        className="drawer-button"
        data-drawer={drawer}
      >
        {hu.blocks.drawer[drawer]}
      </Button>
      <Popover placement="bottom start" className="overlay-menu-popover drawer-popover">
        <Menu
          aria-label={hu.blocks.drawer[drawer]}
          className="overlay-menu"
          items={blocksIn(drawer)}
          onAction={(key) => {
            const block = blocksIn(drawer).find((item) => item.id === key);
            if (block) {
              onInsert(block);
            }
          }}
        >
          {(block) => (
            <MenuItem id={block.id} textValue={plainLines(block).join(" ")} className="drawer-item">
              <Text slot="label" className="drawer-item-title">
                {hu.blocks.items[block.id].title}
              </Text>
              <CodeLines lines={plainLines(block)} keywords={keywords} />
              <Text slot="description" className="drawer-item-hint">
                {hu.blocks.items[block.id].hint}
              </Text>
            </MenuItem>
          )}
        </Menu>
      </Popover>
    </MenuTrigger>
  );
}

export function BlockDrawers({
  isDisabled,
  onInsert,
}: {
  isDisabled: boolean;
  onInsert: (block: Block) => void;
}) {
  const engine = useEngine();
  const keywords = useMemo(() => new Set(engine.keywords()), [engine]);
  return (
    <Toolbar aria-label={hu.blocks.drawers} className="drawers">
      {DRAWER_IDS.map((drawer) => (
        <Drawer
          key={drawer}
          drawer={drawer}
          isDisabled={isDisabled}
          keywords={keywords}
          onInsert={onInsert}
        />
      ))}
    </Toolbar>
  );
}
