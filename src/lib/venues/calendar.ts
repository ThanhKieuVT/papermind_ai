/** iCalendar (RFC 5545) export and Google Calendar links for deadlines. */

export interface CalendarEvent {
  uid: string;
  title: string;
  /** UTC ISO time of the deadline. */
  at: string;
  url: string | null;
  description: string;
}

function icsDate(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export function escapeIcsText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Folds content lines longer than 75 octets, as required by RFC 5545. */
export function foldLine(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const parts: string[] = [];
  let current = "";
  let size = 0;
  for (const ch of line) {
    const n = new TextEncoder().encode(ch).length;
    if (size + n > (parts.length === 0 ? 75 : 74)) {
      parts.push(current);
      current = "";
      size = 0;
    }
    current += ch;
    size += n;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

/** Builds an .ics file with reminders 7 days and 1 day before each deadline. */
export function buildIcs(events: CalendarEvent[], stamp = new Date()): string {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//PaperMind AI//Venue deadlines//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
  for (const e of events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.uid}@papermind`,
      `DTSTAMP:${icsDate(stamp.toISOString())}`,
      `DTSTART:${icsDate(e.at)}`,
      `DTEND:${icsDate(e.at)}`,
      `SUMMARY:${escapeIcsText(e.title)}`,
      `DESCRIPTION:${escapeIcsText(e.description)}`,
      ...(e.url ? [`URL:${e.url}`] : []),
      "BEGIN:VALARM",
      "TRIGGER:-P7D",
      "ACTION:DISPLAY",
      `DESCRIPTION:${escapeIcsText(`${e.title} in 7 days`)}`,
      "END:VALARM",
      "BEGIN:VALARM",
      "TRIGGER:-P1D",
      "ACTION:DISPLAY",
      `DESCRIPTION:${escapeIcsText(`${e.title} tomorrow`)}`,
      "END:VALARM",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}

export function googleCalendarUrl(e: CalendarEvent): string {
  const d = icsDate(e.at);
  const params = new URLSearchParams({ action: "TEMPLATE", text: e.title, dates: `${d}/${d}`, details: e.description + (e.url ? `\n${e.url}` : "") });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
