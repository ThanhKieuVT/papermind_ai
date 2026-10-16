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

/**
 * Deadline in the chosen zone, date first then time:
 * en "Fri, 16 Oct 2026 · 18:59 GMT+7", vi "Thứ 6, 16/10/2026 · 18:59 GMT+7" (AoE shown as "AoE").
 */
export function formatDeadline(iso: string, zone: string, locale = "en-GB"): string {
  const timeZone = resolveZone(zone);
  const date = new Date(iso);
  const vi = locale.startsWith("vi");
  const day = vi
    ? (() => {
        const p = new Intl.DateTimeFormat("vi-VN", { timeZone, weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" }).formatToParts(date);
        const get = (t: string) => p.find((x) => x.type === t)?.value ?? "";
        return `${get("weekday")}, ${get("day")}/${get("month")}/${get("year")}`;
      })()
    : new Intl.DateTimeFormat(locale, { timeZone, weekday: "short", day: "2-digit", month: "short", year: "numeric" }).format(date);
  const time = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZoneName: "shortOffset" })
    .format(date)
    .replace(/GMT-12$/, zone === "Etc/GMT+12" ? "AoE" : "GMT-12");
  return `${day} · ${time}`;
}

export function formatDay(iso: string, zone: string, locale = "en-GB"): string {
  return new Intl.DateTimeFormat(locale, { timeZone: resolveZone(zone), day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));
}

export function formatPercent(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}
