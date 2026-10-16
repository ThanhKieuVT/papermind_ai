import type { AreaCode, CcfRank, CoreRank, DeadlineRound, Edition, Venue } from "@/lib/venues/types";
import { parseHostLocation, type Region } from "@/lib/venues/location";

export type MilestoneKind = "abstract" | "paper" | "rebuttal" | "notification";
export const MILESTONE_LABEL: Record<MilestoneKind, string> = {
  abstract: "Abstract deadline",
  paper: "Paper deadline",
  rebuttal: "Rebuttal",
  notification: "Notification",
};

export interface Milestone {
  kind: MilestoneKind;
  at: string;
}

export type Urgency = "week" | "month" | "later" | "tba";
export const URGENCY_LABEL: Record<Urgency, string> = {
  week: "Due within 7 days",
  month: "Due within 30 days",
  later: "Later",
  tba: "Not announced yet",
};

export interface Estimate {
  /** Approximate next paper deadline (same day-of-year as recent editions). */
  around: string;
  basisYears: number[];
  spreadDays: number;
}

export interface VenueStatus {
  venue: Venue;
  /** Edition the upcoming deadline belongs to, or the most recent edition. */
  edition: Edition | null;
  round: DeadlineRound | null;
  roundIndex: number;
  roundCount: number;
  /** Earliest upcoming submission milestone (abstract or paper). */
  next: Milestone | null;
  /** Upcoming abstract + paper milestones of that round (for display). */
  upcoming: Milestone[];
  urgency: Urgency;
  estimate: Estimate | null;
}

const DAY = 86_400_000;

function submissionMilestones(round: DeadlineRound): Milestone[] {
  const out: Milestone[] = [];
  if (round.abstract) out.push({ kind: "abstract", at: round.abstract });
  if (round.paper) out.push({ kind: "paper", at: round.paper });
  return out;
}

function dayOfYear(iso: string): number {
  const d = new Date(iso);
  return Math.floor((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - Date.UTC(d.getUTCFullYear(), 0, 1)) / DAY);
}

/**
 * Estimates the next deadline from the first-round paper deadlines of the last 3 editions.
 * Returns null when there is too little history or the dates vary by more than 45 days.
 */
export function estimateNextDeadline(venue: Venue, now: Date): Estimate | null {
  const past = venue.editions
    .map((e) => ({ year: e.year, at: e.rounds.find((r) => r.paper)?.paper ?? null }))
    .filter((x): x is { year: number; at: string } => x.at !== null && new Date(x.at) < now)
    .slice(-3);
  if (past.length < 2) return null;
  const days = past.map((p) => dayOfYear(p.at)).sort((a, b) => a - b);
  const spreadDays = (days[days.length - 1] ?? 0) - (days[0] ?? 0);
  if (spreadDays > 45) return null;
  const median = days[Math.floor(days.length / 2)] ?? 0;
  // Next cycle is the year after the most recent past deadline, rolled forward past `now`.
  let year = new Date(past[past.length - 1]!.at).getUTCFullYear() + 1;
  let around = new Date(Date.UTC(year, 0, 1) + median * DAY);
  while (around < now) around = new Date(Date.UTC(++year, 0, 1) + median * DAY);
  return { around: around.toISOString(), basisYears: past.map((p) => p.year), spreadDays };
}

export function urgencyOf(at: string | null, now: Date): Urgency {
  if (!at) return "tba";
  const diff = new Date(at).getTime() - now.getTime();
  if (diff <= 7 * DAY) return "week";
  if (diff <= 30 * DAY) return "month";
  return "later";
}

/** Finds the earliest upcoming submission milestone across all editions and rounds. */
export function venueStatus(venue: Venue, now: Date): VenueStatus {
  let best: { edition: Edition; round: DeadlineRound; index: number; next: Milestone } | null = null;
  for (const edition of venue.editions) {
    edition.rounds.forEach((round, index) => {
      // A round stays relevant until its paper deadline passes.
      const end = round.paper ?? round.abstract;
      if (!end || new Date(end) < now) return;
      const next = submissionMilestones(round).find((m) => new Date(m.at) >= now);
      if (next && (!best || next.at < best.next.at)) best = { edition, round, index, next };
    });
  }
  const found = best as { edition: Edition; round: DeadlineRound; index: number; next: Milestone } | null;
  if (found) {
    return {
      venue,
      edition: found.edition,
      round: found.round,
      roundIndex: found.index,
      roundCount: found.edition.rounds.length,
      next: found.next,
      upcoming: submissionMilestones(found.round).filter((m) => new Date(m.at) >= now),
      urgency: urgencyOf(found.next.at, now),
      estimate: null,
    };
  }
  const latest = venue.editions[venue.editions.length - 1] ?? null;
  return {
    venue,
    edition: latest,
    round: null,
    roundIndex: 0,
    roundCount: latest?.rounds.length ?? 0,
    next: null,
    upcoming: [],
    urgency: "tba",
    estimate: estimateNextDeadline(venue, now),
  };
}

export function latestAcceptRate(venue: Venue) {
  return venue.acceptRates[venue.acceptRates.length - 1] ?? null;
}

// ---- Filtering & sorting ----

export type StatusFilter = "upcoming" | "30d" | "tba" | "followed" | "all";
export type SortKey = "deadline" | "event" | "accept" | "name";

export interface VenueFilters {
  text: string;
  status: StatusFilter;
  areas: AreaCode[];
  ccf: CcfRank[];
  core: CoreRank[];
  regions: Region[];
  /** ISO country codes. */
  countries: string[];
}

export const EMPTY_FILTERS: VenueFilters = { text: "", status: "upcoming", areas: [], ccf: [], core: [], regions: [], countries: [] };

function matchesText(s: VenueStatus, text: string): boolean {
  const tokens = text.toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;
  const hay = [s.venue.acronym, s.venue.name, s.edition?.place ?? "", String(s.edition?.year ?? "")].join(" ").toLowerCase();
  return tokens.every((t) => hay.includes(t));
}

/** Area AND rank; within ranks, a venue matches if it has ANY selected CCF or CORE rank. */
export function filterStatuses(items: VenueStatus[], f: VenueFilters, followed: ReadonlySet<string>, now: Date): VenueStatus[] {
  const in30 = now.getTime() + 30 * DAY;
  return items.filter((s) => {
    if (f.status === "upcoming" && !s.next) return false;
    if (f.status === "30d" && !(s.next && new Date(s.next.at).getTime() <= in30)) return false;
    if (f.status === "tba" && s.next) return false;
    if (f.status === "followed" && !followed.has(s.venue.id)) return false;
    if (f.areas.length && !f.areas.includes(s.venue.area)) return false;
    if (f.regions.length || f.countries.length) {
      const loc = parseHostLocation(s.edition?.place);
      if (f.regions.length && !(loc.region && f.regions.includes(loc.region))) return false;
      if (f.countries.length && !(loc.country && f.countries.includes(loc.country))) return false;
    }
    if (f.ccf.length || f.core.length) {
      const ok =
        (s.venue.ranks.ccf !== null && f.ccf.includes(s.venue.ranks.ccf)) ||
        (s.venue.ranks.core !== null && f.core.includes(s.venue.ranks.core));
      if (!ok) return false;
    }
    return matchesText(s, f.text);
  });
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** Parses the start date from free-form text like "December 7-10, 2026"; falls back to Jan 1 of `year`. */
export function parseEventStart(dateText: string | null, year: number): number {
  const m = dateText ? /([A-Za-z]{3,})\.?\s+(\d{1,2})/.exec(dateText) : null;
  const month = m?.[1] ? MONTHS.indexOf(m[1].slice(0, 3).toLowerCase()) : -1;
  const y = Number(/\b(20\d{2})\b/.exec(dateText ?? "")?.[1] ?? year);
  return month >= 0 && m?.[2] ? Date.UTC(y, month, Number(m[2])) : Date.UTC(year, 0, 1);
}

function eventTime(s: VenueStatus): number {
  return s.edition ? parseEventStart(s.edition.dateText, s.edition.year) : Number.MAX_SAFE_INTEGER;
}

export function sortStatuses(items: VenueStatus[], key: SortKey): VenueStatus[] {
  const byName = (a: VenueStatus, b: VenueStatus) => a.venue.acronym.localeCompare(b.venue.acronym);
  const deadline = (s: VenueStatus) => (s.next ? new Date(s.next.at).getTime() : s.estimate ? new Date(s.estimate.around).getTime() + 1e15 : Number.MAX_SAFE_INTEGER);
  const copy = [...items];
  switch (key) {
    case "name":
      return copy.sort(byName);
    case "event":
      return copy.sort((a, b) => eventTime(a) - eventTime(b) || deadline(a) - deadline(b) || byName(a, b));
    case "accept":
      return copy.sort((a, b) => (latestAcceptRate(a.venue)?.rate ?? 2) - (latestAcceptRate(b.venue)?.rate ?? 2) || byName(a, b));
    default:
      return copy.sort((a, b) => deadline(a) - deadline(b) || byName(a, b));
  }
}

export function groupByUrgency(items: VenueStatus[]): Record<Urgency, VenueStatus[]> {
  const groups: Record<Urgency, VenueStatus[]> = { week: [], month: [], later: [], tba: [] };
  for (const s of items) groups[s.urgency].push(s);
  return groups;
}

export interface CountdownUnits {
  d: string;
  h: string;
  m: string;
  s: string;
  passed: string;
}
const EN_UNITS: CountdownUnits = { d: "d", h: "h", m: "m", s: "s", passed: "Passed" };

/** "3d 04h 12m" style countdown (units are localizable). */
export function formatCountdown(at: string, now: Date, u: CountdownUnits = EN_UNITS): string {
  const ms = new Date(at).getTime() - now.getTime();
  if (ms <= 0) return u.passed;
  const d = Math.floor(ms / DAY);
  const h = Math.floor((ms % DAY) / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  const out = d > 0 ? `${d}${u.d} ${pad(h)}${u.h} ${pad(m)}${u.m}` : `${pad(h)}${u.h} ${pad(m)}${u.m} ${pad(s)}${u.s}`;
  return out.replace(/\s+/g, " ").trim();
}
