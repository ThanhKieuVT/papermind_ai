"use client";

import type { Venue } from "@/lib/venues/types";
import type { MilestoneKind, VenueStatus } from "@/lib/venues/schedule";
import { formatDeadline, formatPercent } from "@/lib/venues/format";
import { countryName, parseHostLocation } from "@/lib/venues/location";
import type { VenueText } from "@/lib/venues/i18n";
import { RankBadges } from "@/components/venues/VenueParts";
import { IconExternal } from "@/components/ui/icons";

const KINDS: MilestoneKind[] = ["abstract", "paper", "rebuttal", "notification"];

function AcceptChart({ venue, t }: { venue: Venue; t: VenueText }) {
  const rates = venue.acceptRates.slice(-6);
  if (rates.length === 0) return <p className="text-sm text-stone-500">{t.detail.noAcceptance}</p>;
  const max = Math.max(...rates.map((r) => r.rate), 0.4);
  return (
    <table className="w-full text-sm">
      <caption className="sr-only">{t.detail.acceptance}</caption>
      <tbody>
        {rates.map((r) => (
          <tr key={r.year}>
            <th scope="row" className="w-14 py-1 text-left font-medium text-stone-600 dark:text-stone-300">{r.year}</th>
            <td className="py-1">
              <div className="flex items-center gap-2">
                <div className="h-2.5 rounded-full bg-brand-400 dark:bg-brand-500" style={{ width: `${(r.rate / max) * 70}%` }} aria-hidden="true" />
                <span className="tabular-nums">{formatPercent(r.rate)}</span>
                {r.accepted && r.submitted && <span className="text-xs text-stone-400">({r.accepted.toLocaleString(t.locale)}/{r.submitted.toLocaleString(t.locale)})</span>}
                {r.source && (
                  <a href={r.source} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-700 hover:underline dark:text-brand-300">{t.detail.source}</a>
                )}
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function VenueDetail({ status, zone, t }: { status: VenueStatus; zone: string; t: VenueText }) {
  const { venue } = status;
  const editions = [...venue.editions].reverse();
  const loc = parseHostLocation(status.edition?.place);
  return (
    <div className="space-y-6 text-sm">
      <div className="space-y-2">
        <p className="text-stone-600 dark:text-stone-300">{venue.name}</p>
        <RankBadges venue={venue} t={t} />
        <ul className="mt-2 space-y-1 text-xs text-stone-500 dark:text-stone-400">
          {venue.ranks.core && <li>{t.rankHelp.core}</li>}
          {venue.ranks.ccf && <li>{t.rankHelp.ccf}</li>}
          {venue.ranks.thcpl && <li>{t.rankHelp.thcpl}</li>}
        </ul>
        <p className="text-xs text-stone-500">
          {t.detail.area}: {t.areas[venue.area]}
          {loc.country && <> · {t.table.where}: {countryName(loc.country, t.locale)}</>}
        </p>
        <div className="flex flex-wrap gap-3 pt-1">
          {status.edition?.link && (
            <a href={status.edition.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-brand-700 hover:underline dark:text-brand-300">
              {t.officialCfp} <IconExternal size={14} />
            </a>
          )}
          {venue.dblp && (
            <a href={venue.dblp} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-brand-700 hover:underline dark:text-brand-300">
              {t.detail.dblp} <IconExternal size={14} />
            </a>
          )}
        </div>
      </div>

      <section>
        <h3 className="mb-2 font-semibold">{t.detail.acceptance}</h3>
        <AcceptChart venue={venue} t={t} />
      </section>

      <section>
        <h3 className="mb-2 font-semibold">{t.detail.byEdition}</h3>
        <p className="mb-2 text-xs text-stone-500">{t.detail.byEditionHint}</p>
        <div className="space-y-3">
          {editions.map((e) => (
            <div key={e.year} className="rounded-xl border border-stone-200 p-3 dark:border-stone-700">
              <p className="font-medium">
                {venue.acronym} {e.year}
                <span className="ml-2 text-xs font-normal text-stone-500">
                  {[e.dateText, e.place].filter((x) => x && x !== "TBD").join(" · ")} · {t.detail.publishedIn(e.timezone)}
                </span>
              </p>
              {e.rounds.length === 0 && <p className="text-xs text-stone-500">{t.detail.noDeadlines}</p>}
              {e.rounds.map((r, i) => (
                <div key={i} className="mt-1.5">
                  {e.rounds.length > 1 && <p className="text-xs font-medium text-stone-500">{t.round(i + 1, e.rounds.length)}{r.comment ? ` · ${r.comment}` : ""}</p>}
                  {e.rounds.length === 1 && r.comment && <p className="text-xs text-stone-500">{r.comment}</p>}
                  <dl className="grid grid-cols-[10rem_1fr] gap-x-3 text-xs">
                    {KINDS.filter((k) => r[k]).map((k) => (
                      <div key={k} className="contents">
                        <dt className="text-stone-500">{t.milestone[k]}</dt>
                        <dd className={new Date(r[k]!) < new Date() ? "text-stone-400 line-through decoration-stone-300" : "text-stone-800 dark:text-stone-100"}>
                          {formatDeadline(r[k]!, zone, t.locale)}
                        </dd>
                      </div>
                    ))}
                    {r.tba && !r.paper && (
                      <div className="contents"><dt className="text-stone-500">{t.milestone.paper}</dt><dd className="italic text-stone-500">{t.detail.tba}</dd></div>
                    )}
                  </dl>
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>
      <p className="text-xs text-stone-400">{t.detail.footer}</p>
    </div>
  );
}
