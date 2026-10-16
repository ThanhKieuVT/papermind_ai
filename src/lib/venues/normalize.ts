/**
 * Normalizes raw ccfddl/ccf-deadlines YAML records (MIT licensed) into our Venue model.
 * Kept free of runtime imports so the sync script can run it directly with Node.
 */
import type { AcceptRate, AreaCode, DeadlineRound, Edition, Venue } from "./types";

const AREA_CODES = ["AI", "CG", "CT", "DB", "DS", "HI", "MX", "NW", "SC", "SE"];

/** Named zones that appear in the dataset, mapped to IANA zones (DST-aware). */
const NAMED_ZONES: Record<string, string> = {
  PT: "America/Los_Angeles",
  PST: "America/Los_Angeles",
  PDT: "America/Los_Angeles",
  ET: "America/New_York",
  EST: "America/New_York",
  EDT: "America/New_York",
  CET: "Europe/Berlin",
  CEST: "Europe/Berlin",
};

/** Offset of `timeZone` from UTC (in minutes) at instant `ts`. */
export function zoneOffsetMinutes(timeZone: string, ts: number): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(ts));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - ts) / 60000);
}

/** Interprets a timezone label. Returns a fixed offset (minutes) or an IANA zone, or null if unknown. */
export function parseTimezone(label: string): { offset: number } | { zone: string } | null {
  const t = label.trim();
  if (/^aoe$/i.test(t)) return { offset: -12 * 60 };
  if (/^(utc|gmt|z)$/i.test(t)) return { offset: 0 };
  const m = /^(?:UTC|GMT)\s*([+-−])\s*(\d{1,2})(?::?(\d{2}))?$/i.exec(t);
  if (m) {
    const sign = m[1] === "+" ? 1 : -1;
    const minutes = Number(m[2]) * 60 + Number(m[3] ?? 0);
    return minutes <= 14 * 60 ? { offset: sign * minutes } : null;
  }
  const zone = NAMED_ZONES[t.toUpperCase()];
  return zone ? { zone } : null;
}

/** Converts a wall-clock "YYYY-MM-DD HH:MM:SS" in the given timezone to a UTC ISO string. */
export function wallTimeToUtc(wall: string, timezone: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(wall.trim());
  const tz = parseTimezone(timezone);
  if (!m || !tz) return null;
  const [, y, mo, d, h = "23", mi = "59", s = "59"] = m;
  const naive = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s));
  if (Number.isNaN(naive)) return null;
  let utc: number;
  if ("offset" in tz) {
    utc = naive - tz.offset * 60000;
  } else {
    // Two passes handle DST transitions.
    const first = naive - zoneOffsetMinutes(tz.zone, naive) * 60000;
    utc = naive - zoneOffsetMinutes(tz.zone, first) * 60000;
  }
  return new Date(utc).toISOString();
}

type Raw = Record<string, unknown>;

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : typeof v === "number" ? String(v) : null);
const isTbd = (v: unknown) => typeof v === "string" && /^tb[ad]$/i.test(v.trim());

function toRound(raw: Raw, timezone: string): DeadlineRound {
  const conv = (v: unknown) => {
    const s = str(v);
    return s && !isTbd(s) ? wallTimeToUtc(s, timezone) : null;
  };
  return {
    abstract: conv(raw.abstract_deadline),
    paper: conv(raw.deadline),
    rebuttal: conv(raw.rebuttal_deadline),
    notification: conv(raw.decision_deadline),
    comment: str(raw.comment),
    tba: isTbd(raw.deadline) || raw.deadline == null,
  };
}

function safeUrl(v: unknown): string | null {
  const s = str(v);
  if (!s) return null;
  try {
    const u = new URL(s);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

function rank<T extends string>(v: unknown, allowed: readonly T[]): T | null {
  const s = str(v);
  return s && (allowed as readonly string[]).includes(s) ? (s as T) : null;
}

/**
 * Normalizes one conference record. `minYear` drops old editions to keep the payload small.
 * Returns null for records without the required fields.
 */
export function normalizeConference(raw: Raw, fileId: string, rates: Raw | null, minYear: number): Venue | null {
  const acronym = str(raw.title);
  const area = str(raw.sub);
  if (!acronym || !area || !AREA_CODES.includes(area)) return null;
  const r = (raw.rank ?? {}) as Raw;

  const editions: Edition[] = (Array.isArray(raw.confs) ? (raw.confs as Raw[]) : [])
    .filter((c) => Number(c.year) >= minYear)
    .map((c) => {
      const timezone = str(c.timezone) ?? "AoE";
      return {
        year: Number(c.year),
        link: safeUrl(c.link),
        dateText: str(c.date),
        place: str(c.place),
        timezone,
        timezoneKnown: parseTimezone(timezone) !== null,
        rounds: (Array.isArray(c.timeline) ? (c.timeline as Raw[]) : []).map((t) => toRound(t, timezone)),
      };
    })
    .sort((a, b) => a.year - b.year);

  const acceptRates: AcceptRate[] = (Array.isArray(rates?.accept_rates) ? (rates.accept_rates as Raw[]) : [])
    .filter((a) => typeof a.rate === "number" && a.rate > 0 && a.rate < 1)
    .map((a) => ({
      year: Number(a.year),
      submitted: typeof a.submitted === "number" ? a.submitted : null,
      accepted: typeof a.accepted === "number" ? a.accepted : null,
      rate: a.rate as number,
      source: safeUrl(a.source),
    }))
    .sort((a, b) => a.year - b.year);

  return {
    id: fileId,
    acronym,
    name: str(raw.description) ?? acronym,
    area: area as AreaCode,
    ranks: {
      ccf: rank(r.ccf, ["A", "B", "C"] as const),
      core: rank(r.core, ["A*", "A", "B", "C"] as const),
      thcpl: rank(r.thcpl, ["A", "B"] as const),
    },
    dblp: str(raw.dblp) ? `https://dblp.org/db/conf/${str(raw.dblp)}/index.html` : null,
    editions,
    acceptRates,
  };
}
