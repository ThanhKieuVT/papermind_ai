/** Display timezones offered in the UI ("local" = the browser's zone). */
export const TIMEZONE_OPTIONS: { value: string; label: string }[] = [
  { value: "local", label: "My local time" },
  { value: "Asia/Ho_Chi_Minh", label: "Vietnam (UTC+7)" },
  { value: "Etc/GMT+12", label: "Anywhere on Earth (AoE, UTC−12)" },
  { value: "UTC", label: "UTC" },
  { value: "America/Los_Angeles", label: "US Pacific" },
  { value: "America/New_York", label: "US Eastern" },
  { value: "Europe/London", label: "London" },
  { value: "Europe/Berlin", label: "Central Europe" },
  { value: "Asia/Shanghai", label: "China (UTC+8)" },
  { value: "Asia/Singapore", label: "Singapore" },
  { value: "Asia/Tokyo", label: "Japan / Korea" },
  { value: "Australia/Sydney", label: "Sydney" },
];

export function resolveZone(value: string): string | undefined {
  return value === "local" ? undefined : value;
}

/** e.g. "Fri, 16 Oct 2026, 18:59 GMT+7" (AoE shown as "AoE"). */
export function formatDeadline(iso: string, zone: string): string {
  const tz = resolveZone(zone);
  const text = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZoneName: "shortOffset",
  }).format(new Date(iso));
  return zone === "Etc/GMT+12" ? text.replace(/GMT-12$/, "AoE") : text;
}

export function formatDay(iso: string, zone: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: resolveZone(zone), day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));
}

export function formatPercent(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}
