import { describe, expect, it } from "vitest";
import { normalizeConference, parseTimezone, wallTimeToUtc } from "@/lib/venues/normalize";
import {
  EMPTY_FILTERS,
  estimateNextDeadline,
  filterStatuses,
  formatCountdown,
  groupByUrgency,
  parseEventStart,
  sortStatuses,
  venueStatus,
} from "@/lib/venues/schedule";
import { buildIcs, escapeIcsText, foldLine, googleCalendarUrl } from "@/lib/venues/calendar";
import type { Venue } from "@/lib/venues/types";

// Shaped exactly like ccfddl/ccf-deadlines records (MIT).
const rawNeurips = {
  title: "NeurIPS",
  description: "Conference on Neural Information Processing Systems",
  sub: "AI",
  rank: { ccf: "A", core: "A*", thcpl: "A" },
  dblp: "nips",
  confs: [
    { year: 2019, id: "nips19", link: "https://x", timeline: [{ deadline: "2019-05-23 20:00:00" }], timezone: "UTC+0", date: "December 8-14, 2019", place: "Vancouver" },
    { year: 2024, id: "nips24", link: "https://neurips.cc/2024", timeline: [{ abstract_deadline: "2024-05-15 20:00:00", deadline: "2024-05-22 20:00:00" }], timezone: "UTC+0", date: "December 11-13, 2024", place: "Vancouver, Canada" },
    { year: 2025, id: "nips25", link: "https://neurips.cc/2025", timeline: [{ abstract_deadline: "2025-05-11 23:59:59", deadline: "2025-05-15 23:59:59" }], timezone: "AoE", date: "December 2-7, 2025", place: "San Diego, USA" },
    { year: 2026, id: "nips26", link: "javascript:alert(1)", timeline: [{ deadline: "TBD" }], timezone: "AoE", date: "TBD", place: "TBD" },
  ],
};
const rawRates = { title: "NeurIPS", accept_rates: [{ year: 2024, submitted: 15671, accepted: 4037, rate: 0.2576, source: "https://media.neurips.cc/x.pdf" }] };

describe("timezone handling", () => {
  it("parses AoE, UTC offsets and named zones", () => {
    expect(parseTimezone("AoE")).toEqual({ offset: -720 });
    expect(parseTimezone("UTC-7")).toEqual({ offset: -420 });
    expect(parseTimezone("UTC+5:30")).toEqual({ offset: 330 });
    expect(parseTimezone("UTC")).toEqual({ offset: 0 });
    expect(parseTimezone("PT")).toEqual({ zone: "America/Los_Angeles" });
    expect(parseTimezone("Mars Time")).toBeNull();
  });

  it("converts wall-clock deadlines to UTC (incl. AoE and DST)", () => {
    expect(wallTimeToUtc("2026-05-15 23:59:59", "AoE")).toBe("2026-05-16T11:59:59.000Z");
    expect(wallTimeToUtc("2026-05-15 23:59:59", "UTC+8")).toBe("2026-05-15T15:59:59.000Z");
    // Pacific: PDT (UTC-7) in summer, PST (UTC-8) in winter
    expect(wallTimeToUtc("2026-07-01 17:00:00", "PT")).toBe("2026-07-02T00:00:00.000Z");
    expect(wallTimeToUtc("2026-12-01 17:00:00", "PT")).toBe("2026-12-02T01:00:00.000Z");
    expect(wallTimeToUtc("TBD", "AoE")).toBeNull();
    expect(wallTimeToUtc("2026-05-15 23:59:59", "Mars Time")).toBeNull();
  });
});

describe("normalizeConference", () => {
  const venue = normalizeConference(rawNeurips, "AI/nips", rawRates, 2021)!;

  it("keeps ranks, links, acceptance rates and recent editions only", () => {
    expect(venue.ranks).toEqual({ ccf: "A", core: "A*", thcpl: "A" });
    expect(venue.dblp).toBe("https://dblp.org/db/conf/nips/index.html");
    expect(venue.editions.map((e) => e.year)).toEqual([2024, 2025, 2026]);
    expect(venue.acceptRates[0]).toMatchObject({ year: 2024, accepted: 4037 });
  });

  it("marks TBD deadlines and drops unsafe links", () => {
    const e2026 = venue.editions.find((e) => e.year === 2026)!;
    expect(e2026.rounds[0]).toMatchObject({ paper: null, tba: true });
    expect(e2026.link).toBeNull();
  });

  it("treats unranked ('N') and invalid areas correctly", () => {
    const v = normalizeConference({ ...rawNeurips, rank: { ccf: "N", core: "N" } }, "AI/x", null, 2021)!;
    expect(v.ranks).toEqual({ ccf: null, core: null, thcpl: null });
    expect(normalizeConference({ ...rawNeurips, sub: "ZZ" }, "ZZ/x", null, 2021)).toBeNull();
  });
});

function venueWith(rounds: Venue["editions"][number]["rounds"], extra: Partial<Venue> = {}): Venue {
  return {
    id: extra.id ?? "AI/test",
    acronym: extra.acronym ?? "TEST",
    name: "Test Conference",
    area: extra.area ?? "AI",
    ranks: extra.ranks ?? { ccf: "A", core: "A*", thcpl: null },
    dblp: null,
    acceptRates: extra.acceptRates ?? [],
    editions: extra.editions ?? [{ year: 2026, link: null, dateText: "December 1-5, 2026", place: "Hanoi", timezone: "AoE", timezoneKnown: true, rounds }],
  };
}
const round = (abstract: string | null, paper: string | null) => ({ abstract, paper, rebuttal: null, notification: null, comment: null, tba: paper === null });

describe("venueStatus", () => {
  const now = new Date("2026-10-16T00:00:00Z");

  it("picks the earliest upcoming milestone, preferring the abstract when it comes first", () => {
    const s = venueStatus(venueWith([round("2026-10-20T00:00:00Z", "2026-10-27T00:00:00Z")]), now);
    expect(s.next).toEqual({ kind: "abstract", at: "2026-10-20T00:00:00Z" });
    expect(s.upcoming).toHaveLength(2);
    expect(s.urgency).toBe("week");
  });

  it("keeps a round whose abstract passed but paper deadline is still open", () => {
    const s = venueStatus(venueWith([round("2026-10-10T00:00:00Z", "2026-11-20T00:00:00Z")]), now);
    expect(s.next?.kind).toBe("paper");
    expect(s.urgency).toBe("later");
  });

  it("chooses the right round in multi-round venues", () => {
    const s = venueStatus(venueWith([round(null, "2026-09-01T00:00:00Z"), round(null, "2026-11-01T00:00:00Z"), round(null, "2027-01-01T00:00:00Z")]), now);
    expect(s.roundIndex).toBe(1);
    expect(s.roundCount).toBe(3);
    expect(s.urgency).toBe("month");
  });

  it("returns tba with an estimate when history is consistent", () => {
    const editions = [2023, 2024, 2025].map((y) => ({
      year: y, link: null, dateText: null, place: null, timezone: "AoE", timezoneKnown: true,
      rounds: [round(null, `${y}-05-${y === 2024 ? "20" : "15"}T12:00:00Z`)],
    }));
    const s = venueStatus(venueWith([], { editions }), now);
    expect(s.next).toBeNull();
    expect(s.urgency).toBe("tba");
    expect(s.estimate).toMatchObject({ basisYears: [2023, 2024, 2025] });
    expect(s.estimate!.around.startsWith("2027-05-1")).toBe(true);
  });

  it("estimates the following year when this year's deadline already passed", () => {
    const editions = [2024, 2025, 2026].map((y) => ({
      year: y, link: null, dateText: null, place: null, timezone: "AoE", timezoneKnown: true,
      rounds: [round(null, `${y}-10-10T12:00:00Z`)],
    }));
    const s = venueStatus(venueWith([], { editions }), new Date("2026-10-16T00:00:00Z"));
    expect(s.estimate!.around.startsWith("2027-10-")).toBe(true);
  });

  it("refuses to estimate when deadlines move around a lot", () => {
    const editions = [["2024-01-10"], ["2025-06-10"]].map(([d], i) => ({
      year: 2024 + i, link: null, dateText: null, place: null, timezone: "AoE", timezoneKnown: true, rounds: [round(null, `${d}T00:00:00Z`)],
    }));
    expect(estimateNextDeadline(venueWith([], { editions }), now)).toBeNull();
  });
});

describe("filtering, sorting and grouping", () => {
  const now = new Date("2026-10-16T00:00:00Z");
  const a = venueStatus(venueWith([round(null, "2026-10-18T00:00:00Z")], { id: "AI/a", acronym: "ALPHA", ranks: { ccf: "A", core: null, thcpl: null }, acceptRates: [{ year: 2025, submitted: 100, accepted: 20, rate: 0.2, source: null }] }), now);
  const b = venueStatus(venueWith([round(null, "2026-12-30T00:00:00Z")], { id: "DB/b", acronym: "BETA", area: "DB", ranks: { ccf: "B", core: "A*", thcpl: null }, acceptRates: [{ year: 2025, submitted: 100, accepted: 30, rate: 0.3, source: null }] }), now);
  const c = venueStatus(venueWith([], { id: "SE/c", acronym: "GAMMA", area: "SE", ranks: { ccf: null, core: "C", thcpl: null } }), now);
  const all = [c, b, a];

  it("filters by status, area, rank (any) and text", () => {
    const f = (patch: Partial<typeof EMPTY_FILTERS>, followed = new Set<string>()) => filterStatuses(all, { ...EMPTY_FILTERS, ...patch }, followed, now).map((s) => s.venue.acronym);
    expect(f({})).toEqual(["BETA", "ALPHA"]);
    expect(f({ status: "30d" })).toEqual(["ALPHA"]);
    expect(f({ status: "tba" })).toEqual(["GAMMA"]);
    expect(f({ status: "all", areas: ["DB", "SE"] })).toEqual(["GAMMA", "BETA"]);
    expect(f({ status: "all", ccf: ["A"], core: ["A*"] })).toEqual(["BETA", "ALPHA"]);
    expect(f({ status: "all", text: "hanoi alpha" })).toEqual(["ALPHA"]);
    expect(f({ status: "followed" }, new Set(["SE/c"]))).toEqual(["GAMMA"]);
  });

  it("sorts by deadline, acceptance rate and name; groups by urgency", () => {
    expect(sortStatuses(all, "deadline").map((s) => s.venue.acronym)).toEqual(["ALPHA", "BETA", "GAMMA"]);
    expect(sortStatuses(all, "accept").map((s) => s.venue.acronym)).toEqual(["ALPHA", "BETA", "GAMMA"]);
    expect(sortStatuses(all, "name").map((s) => s.venue.acronym)).toEqual(["ALPHA", "BETA", "GAMMA"]);
    const g = groupByUrgency(all);
    expect([g.week.length, g.month.length, g.later.length, g.tba.length]).toEqual([1, 0, 1, 1]);
  });

  it("formats countdowns and parses event dates", () => {
    expect(formatCountdown("2026-10-19T04:05:00Z", now)).toBe("3d 04h 05m");
    expect(formatCountdown("2026-10-16T01:02:03Z", now)).toBe("01h 02m 03s");
    expect(formatCountdown("2026-10-01T00:00:00Z", now)).toBe("Passed");
    expect(new Date(parseEventStart("December 7-10, 2026", 2026)).toISOString().slice(0, 10)).toBe("2026-12-07");
    expect(new Date(parseEventStart("TBD", 2027)).toISOString().slice(0, 10)).toBe("2027-01-01");
  });
});

describe("calendar export", () => {
  const event = { uid: "nips26-paper", title: "NeurIPS 2026, Paper deadline", at: "2026-05-16T11:59:59.000Z", url: "https://neurips.cc", description: "Line one\nCORE A*; CCF A" };

  it("builds a valid iCalendar file with reminders and escaped text", () => {
    const ics = buildIcs([event], new Date("2026-01-01T00:00:00Z"));
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("DTSTART:20260516T115959Z");
    expect(ics).toContain("SUMMARY:NeurIPS 2026\\, Paper deadline");
    expect(ics).toContain("DESCRIPTION:Line one\\nCORE A*\\; CCF A");
    expect(ics.match(/BEGIN:VALARM/g)).toHaveLength(2);
    expect(ics.split("\r\n").every((l) => new TextEncoder().encode(l).length <= 75)).toBe(true);
  });

  it("escapes and folds per RFC 5545", () => {
    expect(escapeIcsText("a,b;c\\d")).toBe("a\\,b\\;c\\\\d");
    const folded = foldLine("X".repeat(160));
    expect(folded.split("\r\n ").map((p) => p.length)).toEqual([75, 74, 11]);
  });

  it("creates Google Calendar links in UTC", () => {
    const url = new URL(googleCalendarUrl(event));
    expect(url.searchParams.get("dates")).toBe("20260516T115959Z/20260516T115959Z");
  });
});
