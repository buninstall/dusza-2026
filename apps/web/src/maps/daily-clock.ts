const DAY_ZONE = "Europe/Budapest";
const MS_PER_DAY = 86_400_000;
const ROLLOVER_GRACE_MS = 30_000;
const MIN_WAIT_MS = 60_000;
const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

const wallClock = new Intl.DateTimeFormat("en-GB", {
  timeZone: DAY_ZONE,
  hourCycle: "h23",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

const dayFormat = new Intl.DateTimeFormat("hu-HU", {
  timeZone: "UTC",
  month: "long",
  day: "numeric",
});

export function msUntilNextDay(now: number): number {
  const parts = wallClock.formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((entry) => entry.type === type)?.value ?? 0);
  const elapsed = ((part("hour") * 60 + part("minute")) * 60 + part("second")) * 1000;
  return Math.max(MIN_WAIT_MS, MS_PER_DAY - elapsed + ROLLOVER_GRACE_MS);
}

export function dayLabel(key: string): string {
  if (!DAY_KEY.test(key)) {
    return "";
  }
  const date = new Date(`${key}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? "" : dayFormat.format(date);
}
