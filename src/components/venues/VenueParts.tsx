"use client";

import { useEffect, useState } from "react";
import type { Venue } from "@/lib/venues/types";
import { formatCountdown, latestAcceptRate } from "@/lib/venues/schedule";
import { formatPercent } from "@/lib/venues/format";
import { VENUE_TEXT, type VenueText } from "@/lib/venues/i18n";
import { cx } from "@/components/ui/primitives";

function RankPill({ system, value, help }: { system: string; value: string; help: string }) {
  const strong = value === "A*" || (value === "A" && system !== "THCPL");
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs ring-1 ring-inset",
        strong
          ? "bg-[#e9ecdf] text-[#3d4432] ring-[#cfd5c0] dark:bg-[#2a3022] dark:text-[#dfe4d2] dark:ring-[#3d4432]"
          : "bg-stone-50 text-stone-600 ring-stone-200 dark:bg-stone-800 dark:text-stone-300 dark:ring-stone-700",
      )}
      title={help}
    >
      <span className="text-[10px] font-medium uppercase tracking-wide opacity-70">{system}</span>
      <span className="font-semibold">{value}</span>
    </span>
  );
}

export function RankBadges({ venue, t = VENUE_TEXT.en }: { venue: Venue; t?: VenueText }) {
  const { ccf, core, thcpl } = venue.ranks;
  if (!ccf && !core && !thcpl) {
    return <span className="text-xs italic text-stone-400" title={t.unrankedHint}>{t.unranked}</span>;
  }
  return (
    <span className="flex flex-wrap gap-1.5">
      {core && <RankPill system="CORE" value={core} help={t.rankHelp.core} />}
      {ccf && <RankPill system="CCF" value={ccf} help={t.rankHelp.ccf} />}
      {thcpl && <RankPill system="THCPL" value={thcpl} help={t.rankHelp.thcpl} />}
    </span>
  );
}

export function AcceptRateText({ venue, t = VENUE_TEXT.en }: { venue: Venue; t?: VenueText }) {
  const r = latestAcceptRate(venue);
  if (!r) return null;
  return (
    <span className="text-xs text-stone-500 dark:text-stone-400" title={r.submitted && r.accepted ? t.acceptedOf(r.accepted, r.submitted) : undefined}>
      {t.acceptance} <span className="font-semibold text-stone-700 dark:text-stone-200">{formatPercent(r.rate)}</span> ({r.year})
    </span>
  );
}

/** Self-updating countdown: every second inside 24 h, otherwise every 30 s. */
export function Countdown({ at, className, t = VENUE_TEXT.en }: { at: string; className?: string; t?: VenueText }) {
  const target = new Date(at).getTime();
  const [now, setNow] = useState(() => new Date());
  const close = target - now.getTime() < 86_400_000;
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), close ? 1000 : 30_000);
    return () => clearInterval(id);
  }, [close]);
  const days = (target - now.getTime()) / 86_400_000;
  const tone = days < 3 ? "text-[#a3542e] dark:text-[#e3a07c]" : days < 14 ? "text-[#8a6a2a] dark:text-[#d8bd7f]" : "text-brand-600 dark:text-brand-300";
  const text = formatCountdown(at, now, t.countdown);
  return (
    <span className={cx("whitespace-nowrap font-semibold tabular-nums", tone, className)} aria-label={`${t.timeLeft}: ${text}`}>
      {text}
    </span>
  );
}
