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
import "./Tabs.css";

export function Tabs(props: Omit<TabsProps, "className">) {
  return <AriaTabs {...props} className="tabs" />;
}

export function TabList<T extends object>(props: Omit<TabListProps<T>, "className">) {
  return <AriaTabList {...props} className="tabs-list" />;
}

export function Tab(props: Omit<TabProps, "className">) {
  return <AriaTab {...props} className="tabs-tab" />;
}

export function TabPanel(props: Omit<TabPanelProps, "className">) {
  return <AriaTabPanel {...props} className="tabs-panel" />;
}
