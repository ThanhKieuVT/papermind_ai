"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useFollows, useVenues } from "@/hooks/useVenues";
import { MILESTONE_LABEL, venueStatus } from "@/lib/venues/schedule";
import { TIMEZONE_OPTIONS, formatDeadline } from "@/lib/venues/format";
import { Card, Spinner } from "@/components/ui/primitives";
import { IconCalendar } from "@/components/ui/icons";
import { Countdown, RankBadges } from "@/components/venues/VenueParts";

/** Dashboard widget: next deadlines of followed venues, or of top-ranked venues if none are followed. */
export function UpcomingDeadlines() {
  const state = useVenues();
  const follows = useFollows();
  const [zone, setZone] = useState("local");
  useEffect(() => {
    try {
      const saved = localStorage.getItem("papermind:venue-timezone");
      if (saved && TIMEZONE_OPTIONS.some((o) => o.value === saved)) setZone(saved);
    } catch {
      // ignore
    }
  }, []);

  const items = useMemo(() => {
    if (state.status !== "ready") return [];
    const now = new Date();
    const pool = state.data.venues.filter((v) => (follows.size ? follows.has(v.id) : v.ranks.core === "A*" || v.ranks.ccf === "A"));
    return pool
      .map((v) => venueStatus(v, now))
      .filter((s) => s.next)
      .sort((a, b) => a.next!.at.localeCompare(b.next!.at))
      .slice(0, 4);
  }, [state, follows]);

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-semibold">
          <span className="text-brand-600 dark:text-brand-300"><IconCalendar size={18} /></span>
          {follows.size ? "Your next deadlines" : "Upcoming top-venue deadlines"}
        </h2>
        <Link href={follows.size ? "/venues?status=followed" : "/venues"} className="text-sm font-medium text-brand-700 hover:underline dark:text-brand-300">All venues</Link>
      </div>
      {state.status === "loading" && <Spinner label="Loading…" />}
      {state.status === "error" && <p className="text-sm text-stone-500">{state.message}</p>}
      {state.status === "ready" && items.length === 0 && (
        <p className="text-sm text-stone-500">No upcoming deadlines{follows.size ? " for the venues you follow" : ""}.</p>
      )}
      <ul className="divide-y divide-stone-100 dark:divide-stone-800">
        {items.map((s) => (
          <li key={s.venue.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 font-medium text-stone-900 dark:text-white">
                {s.venue.acronym} {s.edition?.year} <RankBadges venue={s.venue} />
              </p>
              <p className="text-xs text-stone-500">{MILESTONE_LABEL[s.next!.kind]} · {formatDeadline(s.next!.at, zone)}</p>
            </div>
            <Countdown at={s.next!.at} />
          </li>
        ))}
      </ul>
      {!follows.size && state.status === "ready" && (
        <p className="mt-2 text-xs text-stone-400">Tip: follow venues on the Venues page to see only yours here.</p>
      )}
    </Card>
  );
}
