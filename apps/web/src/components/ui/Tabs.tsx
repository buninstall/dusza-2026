import { clsx } from "clsx";
import {
  Tab as AriaTab,
  TabList as AriaTabList,
  TabPanel as AriaTabPanel,
  Tabs as AriaTabs,
  type TabListProps,
  type TabPanelProps,
  type TabProps,
  type TabsProps,
} from "react-aria-components";

export function Tabs(props: TabsProps) {
  return <AriaTabs {...props} />;
}

export function TabList<T extends object>({ className, ...props }: TabListProps<T>) {
  return (
    <AriaTabList
      {...props}
      className={clsx(
        "inline-flex gap-1 rounded-[12px] border border-line bg-paper-sunken p-1",
        typeof className === "string" ? className : null,
      )}
    />
  );
}

export function Tab(props: TabProps) {
  return (
    <AriaTab
      {...props}
      className="cursor-default rounded-[9px] px-3 py-1.5 text-sm font-semibold text-ink-muted outline-none transition-colors data-[hovered]:text-ink data-[selected]:bg-paper-raised data-[selected]:text-ink data-[selected]:shadow-plate data-[focus-visible]:outline-3 data-[focus-visible]:outline-lamp"
    />
  );
}

export function TabPanel({ className, ...props }: TabPanelProps) {
  return (
    <AriaTabPanel
      {...props}
      className={clsx("outline-none", typeof className === "string" ? className : null)}
    />
  );
}
