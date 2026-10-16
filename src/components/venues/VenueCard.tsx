"use client";

import type { VenueStatus } from "@/lib/venues/schedule";
import { formatDay, formatDeadline } from "@/lib/venues/format";
import { googleCalendarUrl } from "@/lib/venues/calendar";
import { countryName, parseHostLocation } from "@/lib/venues/location";
import type { VenueText } from "@/lib/venues/i18n";
import { cx } from "@/components/ui/primitives";
import { IconCalendar, IconExternal, IconStar } from "@/components/ui/icons";
import { AcceptRateText, Countdown, RankBadges } from "@/components/venues/VenueParts";
import { milestoneEvent } from "@/components/venues/events";

export interface VenueItemProps {
  status: VenueStatus;
  zone: string;
  t: VenueText;
  followed: boolean;
  onToggleFollow: () => void;
  onOpen: () => void;
  onDownloadIcs: () => void;
}

const clean = (s: string | null | undefined) => (s && s !== "TBD" ? s : null);

export function FollowButton({ followed, onClick, t, compact = false }: { followed: boolean; onClick: () => void; t: VenueText; compact?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={followed}
      aria-label={compact ? (followed ? t.following : t.follow) : undefined}
      title={compact ? (followed ? t.following : t.follow) : undefined}
      className={cx(
        "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition",
        followed ? "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200" : "text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800",
      )}
    >
      <IconStar size={16} filled={followed} />
      {!compact && (followed ? t.following : t.follow)}
    </button>
  );
}

function UnannouncedInfo({ status, zone, t }: { status: VenueStatus; zone: string; t: VenueText }) {
  const { edition, estimate } = status;
  return (
    <>
      {edition && edition.year < new Date().getFullYear() - 1 && (
        <p className="mt-0.5 text-xs text-[#a3542e] dark:text-[#e3a07c]">{t.stale(edition.year)}</p>
      )}
      {estimate ? (
        <p className="mt-0.5 text-xs italic text-stone-500" title={t.estimateHint}>
          {t.usuallyAround(formatDay(estimate.around, zone, t.locale), estimate.basisYears.join(", "))}
        </p>
      ) : (
        <p className="mt-0.5 text-xs italic text-stone-400">{t.noPattern}</p>
      )}
    </>
  );
}

export function VenueCard({ status, zone, t, followed, onToggleFollow, onOpen, onDownloadIcs }: VenueItemProps) {
  const { venue, edition, upcoming, next, roundIndex, roundCount } = status;
  const nextEvent = next && edition ? milestoneEvent(venue, edition, next, t) : null;

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
            <RankBadges venue={venue} t={t} />
          </div>
          <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">{venue.name}</p>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-500 dark:text-stone-400">
            {clean(edition?.dateText) && <span>📅 {edition!.dateText}</span>}
            {clean(edition?.place) && <span>📍 {edition!.place}</span>}
            <span>{t.areas[venue.area]}</span>
            <AcceptRateText venue={venue} t={t} />
          </p>
        </div>

        <div className="md:w-[19rem] md:shrink-0 md:text-right">
          {upcoming.length > 0 ? (
            <ul className="space-y-1.5">
              {upcoming.map((m) => (
                <li key={m.kind}>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-stone-500">
                    {t.milestone[m.kind]}
                    {roundCount > 1 && ` · ${t.round(roundIndex + 1, roundCount)}`}
                  </p>
                  <p className="text-sm text-stone-800 dark:text-stone-100">{formatDeadline(m.at, zone, t.locale)}</p>
                  {next && m.kind === next.kind && m.at === next.at && <Countdown at={m.at} className="text-lg" t={t} />}
                </li>
              ))}
            </ul>
          ) : (
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-stone-500">{t.nextDeadline}</p>
              <p className="text-sm font-medium text-stone-700 dark:text-stone-200">{t.notAnnounced}</p>
              <UnannouncedInfo status={status} zone={zone} t={t} />
            </div>
          )}
          {edition && !edition.timezoneKnown && <p className="mt-1 text-xs text-[#a3542e]">{t.tzUnclear(edition.timezone)}</p>}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-stone-100 pt-3 dark:border-stone-800">
        <FollowButton followed={followed} onClick={onToggleFollow} t={t} />
        {nextEvent && (
          <>
            <button type="button" onClick={onDownloadIcs} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800" aria-label={t.downloadIcs(venue.acronym)}>
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
            {t.officialCfp} <IconExternal size={14} />
          </a>
        )}
        <button type="button" onClick={onOpen} className="rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-stone-700 ring-1 ring-inset ring-stone-200 hover:bg-stone-50 dark:text-stone-200 dark:ring-stone-700 dark:hover:bg-stone-800">
          {t.details}
        </button>
      </div>
    </article>
  );
}

/** Dense one-row-per-venue view. Becomes stacked rows on small screens. */
export function VenueTable({ items, zone, t, followed, onToggleFollow, onOpen }: {
  items: VenueStatus[];
  zone: string;
  t: VenueText;
  followed: ReadonlySet<string>;
  onToggleFollow: (id: string) => void;
  onOpen: (id: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-stone-200/80 bg-white dark:border-stone-800 dark:bg-stone-900">
      <table className="w-full text-sm">
        <thead className="hidden bg-stone-50 text-left text-[11px] uppercase tracking-wide text-stone-500 dark:bg-stone-800/60 md:table-header-group">
          <tr>
            <th scope="col" className="w-10 px-3 py-2"><span className="sr-only">{t.follow}</span></th>
            <th scope="col" className="px-3 py-2">{t.table.venue}</th>
            <th scope="col" className="px-3 py-2">{t.table.ranks}</th>
            <th scope="col" className="px-3 py-2">{t.table.deadline}</th>
            <th scope="col" className="px-3 py-2 text-right">{t.table.left}</th>
            <th scope="col" className="px-3 py-2">{t.table.where}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
          {items.map((s) => {
            const loc = parseHostLocation(s.edition?.place);
            return (
              <tr key={s.venue.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-x-2 px-2 py-2 hover:bg-stone-50 dark:hover:bg-stone-800/40 md:table-row md:p-0">
                <td className="md:px-3 md:py-2">
                  <FollowButton followed={followed.has(s.venue.id)} onClick={() => onToggleFollow(s.venue.id)} t={t} compact />
                </td>
                <td className="min-w-0 md:px-3 md:py-2">
                  <button type="button" onClick={() => onOpen(s.venue.id)} className="block w-full min-w-0 text-left">
                    <span className="font-semibold text-stone-900 hover:text-brand-700 dark:text-white">{s.venue.acronym}</span>{" "}
                    <span className="text-stone-400">{s.edition?.year}</span>
                    <span className="block truncate text-xs text-stone-500 md:max-w-[22rem]">{s.venue.name}</span>
                  </button>
                </td>
                <td className="col-start-2 md:px-3 md:py-2"><RankBadges venue={s.venue} t={t} /></td>
                <td className="col-span-2 col-start-2 text-xs text-stone-700 dark:text-stone-200 md:col-auto md:px-3 md:py-2 md:text-sm">
                  {s.next ? (
                    <>
                      <span className="text-[11px] uppercase tracking-wide text-stone-500">{t.milestone[s.next.kind]}</span>
                      <span className="block">{formatDeadline(s.next.at, zone, t.locale)}</span>
                    </>
                  ) : (
                    <span className="italic text-stone-500">{t.notAnnounced}</span>
                  )}
                </td>
                <td className="col-start-3 row-start-1 text-right md:px-3 md:py-2">
                  {s.next ? <Countdown at={s.next.at} t={t} /> : <span className="text-stone-300">—</span>}
                </td>
                <td className="col-span-2 col-start-2 text-xs text-stone-500 md:col-auto md:px-3 md:py-2">
                  {loc.country ? countryName(loc.country, t.locale) : loc.region ? t.regions[loc.region] : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
