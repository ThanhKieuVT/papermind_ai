import type { Edition, Venue } from "@/lib/venues/types";
import type { CalendarEvent } from "@/lib/venues/calendar";
import type { Milestone, VenueStatus } from "@/lib/venues/schedule";
import { VENUE_TEXT, type VenueText } from "@/lib/venues/i18n";

export function milestoneEvent(venue: Venue, edition: Edition, m: Milestone, t: VenueText = VENUE_TEXT.en): CalendarEvent {
  const ranks = [venue.ranks.core && `CORE ${venue.ranks.core}`, venue.ranks.ccf && `CCF ${venue.ranks.ccf}`].filter(Boolean).join(", ");
  return {
    uid: `${venue.id.replace("/", "-")}-${edition.year}-${m.kind}-${m.at}`,
    title: `${venue.acronym} ${edition.year}: ${t.milestone[m.kind]}`,
    at: m.at,
    url: edition.link,
    description: `${venue.name}${ranks ? ` (${ranks})` : ""}. ${t.calendarNote(edition.timezone)}`,
  };
}

/** Calendar events for every upcoming submission milestone of the given venues. */
export function statusEvents(items: VenueStatus[], t: VenueText = VENUE_TEXT.en): CalendarEvent[] {
  return items.flatMap((s) => (s.edition ? s.upcoming.map((m) => milestoneEvent(s.venue, s.edition!, m, t)) : []));
}
