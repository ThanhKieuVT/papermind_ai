"use client";

import type { VenueStatus } from "@/lib/venues/schedule";
import { MILESTONE_LABEL } from "@/lib/venues/schedule";
import { formatDay, formatDeadline } from "@/lib/venues/format";
import { googleCalendarUrl } from "@/lib/venues/calendar";
import { cx } from "@/components/ui/primitives";
import { IconCalendar, IconExternal, IconStar } from "@/components/ui/icons";
import { AcceptRateText, AreaTag, Countdown, RankBadges } from "@/components/venues/VenueParts";
import { milestoneEvent } from "@/components/venues/events";

export function VenueCard({
  status,
  zone,
  followed,
  onToggleFollow,
  onOpen,
  onDownloadIcs,
}: {
  status: VenueStatus;
  zone: string;
  followed: boolean;
  onToggleFollow: () => void;
  onOpen: () => void;
  onDownloadIcs: () => void;
}) {
  const { venue, edition, upcoming, next, estimate, roundIndex, roundCount } = status;
  const nextEvent = next && edition ? milestoneEvent(venue, edition, next) : null;

  return (
    <article
      className={cx(
        "rounded-2xl border bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:shadow-md dark:bg-stone-900",
        followed ? "border-brand-300 dark:border-brand-700" : "border-stone-200/80 dark:border-stone-800",
      )}
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h3 className="text-lg font-semibold tracking-tight text-stone-900 dark:text-white">
              <button type="button" onClick={onOpen} className="hover:text-brand-700 dark:hover:text-brand-300">
                {venue.acronym} <span className="font-normal text-stone-400">{edition?.year ?? ""}</span>
              </button>
            </h3>
            <RankBadges venue={venue} />
          </div>
          <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">{venue.name}</p>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-500 dark:text-stone-400">
            {edition?.dateText && edition.dateText !== "TBD" && <span>📅 {edition.dateText}</span>}
            {edition?.place && edition.place !== "TBD" && <span>📍 {edition.place}</span>}
            <AreaTag venue={venue} />
            <AcceptRateText venue={venue} />
          </p>
        </div>

        <div className="md:w-[19rem] md:shrink-0 md:text-right">
          {upcoming.length > 0 ? (
            <ul className="space-y-1.5">
              {upcoming.map((m) => (
                <li key={m.kind}>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-stone-500">
                    {MILESTONE_LABEL[m.kind]}
                    {roundCount > 1 && ` · Round ${roundIndex + 1}/${roundCount}`}
                  </p>
                  <p className="text-sm text-stone-800 dark:text-stone-100">{formatDeadline(m.at, zone)}</p>
                  {next && m.kind === next.kind && m.at === next.at && <Countdown at={m.at} className="text-lg" />}
                </li>
              ))}
            </ul>
          ) : (
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-stone-500">Next deadline</p>
              <p className="text-sm font-medium text-stone-700 dark:text-stone-200">Not announced yet</p>
              {edition && edition.year < new Date().getFullYear() - 1 && (
                <p className="mt-0.5 text-xs text-[#a3542e] dark:text-[#e3a07c]">No edition listed since {edition.year}: the venue may have merged or stopped.</p>
              )}
              {estimate ? (
                <p className="mt-0.5 text-xs italic text-stone-500" title="Estimated from the dates of recent editions. Not an official date.">
                  Usually around {formatDay(estimate.around, zone)} (based on {estimate.basisYears.join(", ")})
                </p>
              ) : (
                <p className="mt-0.5 text-xs italic text-stone-400">No stable pattern in recent years</p>
              )}
            </div>
          )}
          {edition && !edition.timezoneKnown && (
            <p className="mt-1 text-xs text-[#a3542e]">Timezone “{edition.timezone}” unclear: check the CFP.</p>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-stone-100 pt-3 dark:border-stone-800">
        <button
          type="button"
          onClick={onToggleFollow}
          aria-pressed={followed}
          className={cx(
            "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition",
            followed ? "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200" : "text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800",
          )}
        >
          <IconStar size={16} filled={followed} /> {followed ? "Following" : "Follow"}
        </button>
        {nextEvent && (
          <>
            <button type="button" onClick={onDownloadIcs} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800" aria-label={`Download calendar file for ${venue.acronym}`}>
              <IconCalendar size={16} /> .ics
            </button>
            <a href={googleCalendarUrl(nextEvent)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800">
              Google Calendar
            </a>
          </>
        )}
        <span className="flex-1" />
        {edition?.link && (
          <a href={edition.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-500/10">
            Official CFP <IconExternal size={14} />
          </a>
        )}
        <button type="button" onClick={onOpen} className="rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-stone-700 ring-1 ring-inset ring-stone-200 hover:bg-stone-50 dark:text-stone-200 dark:ring-stone-700 dark:hover:bg-stone-800">
          Details
        </button>
      </div>
    </article>
  );
}
