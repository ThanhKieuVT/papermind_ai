import type { Edition, Venue } from "@/lib/venues/types";
import type { CalendarEvent } from "@/lib/venues/calendar";
import { MILESTONE_LABEL, type Milestone, type VenueStatus } from "@/lib/venues/schedule";

export function milestoneEvent(venue: Venue, edition: Edition, m: Milestone): CalendarEvent {
  const ranks = [venue.ranks.core && `CORE ${venue.ranks.core}`, venue.ranks.ccf && `CCF ${venue.ranks.ccf}`].filter(Boolean).join(", ");
  return {
    uid: `${venue.id.replace("/", "-")}-${edition.year}-${m.kind}-${m.at}`,
    title: `${venue.acronym} ${edition.year}: ${MILESTONE_LABEL[m.kind]}`,
    at: m.at,
    url: edition.link,
    description: `${venue.name}${ranks ? ` (${ranks})` : ""}. Published timezone: ${edition.timezone}. Always confirm on the official CFP.`,
  };
}

/** Calendar events for every upcoming submission milestone of the given venues. */
export function statusEvents(items: VenueStatus[]): CalendarEvent[] {
  return items.flatMap((s) => (s.edition ? s.upcoming.map((m) => milestoneEvent(s.venue, s.edition!, m)) : []));
}
