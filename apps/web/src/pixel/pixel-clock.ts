type Channel = {
  attr: string;
  value: string;
  period: number;
  windows: readonly [number, number][];
};

const TICK_MS = 40;

const CHANNELS: readonly Channel[] = [
  { attr: "glint", value: "off", period: 2400, windows: [[0.71, 0.86]] },
  {
    attr: "lamp",
    value: "off",
    period: 8000,
    windows: [
      [0.805, 0.825],
      [0.845, 0.865],
    ],
  },
  { attr: "beam", value: "dim", period: 8000, windows: [[0.97, 0.99]] },
];

function isInside(channel: Channel, now: number): boolean {
  const phase = (now % channel.period) / channel.period;
  return channel.windows.some(([from, to]) => phase >= from && phase < to);
}

export function startPixelClock(): () => void {
  const root = document.documentElement;
  const media = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  const shown = new Map<string, boolean>();
  const tick = () => {
    const now = performance.now();
    const isStill = media?.matches ?? false;
    for (const channel of CHANNELS) {
      const isOn = !isStill && isInside(channel, now);
      if (shown.get(channel.attr) === isOn) continue;
      shown.set(channel.attr, isOn);
      if (isOn) root.dataset[channel.attr] = channel.value;
      else delete root.dataset[channel.attr];
    }
  };
  tick();
  const timer = window.setInterval(tick, TICK_MS);
  return () => window.clearInterval(timer);
}
