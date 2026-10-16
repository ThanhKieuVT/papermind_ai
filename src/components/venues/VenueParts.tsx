"use client";

import { useEffect, useState } from "react";
import type { Venue } from "@/lib/venues/types";
import { AREAS } from "@/lib/venues/types";
import { formatCountdown, latestAcceptRate } from "@/lib/venues/schedule";
import { formatPercent } from "@/lib/venues/format";
import { cx } from "@/components/ui/primitives";

export const RANK_HELP = {
  ccf: "CCF (China Computer Federation) list — A: top international venues, B: important, C: recognised.",
  core: "CORE (Australia) — A*: flagship, A: excellent, B: good, C: meets minimum standards.",
  thcpl: "THCPL (Tsinghua University CS venue list) — A or B.",
} as const;

function RankPill({ system, value }: { system: string; value: string }) {
  const strong = value === "A*" || (value === "A" && system !== "THCPL");
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs ring-1 ring-inset",
        strong
          ? "bg-[#e9ecdf] text-[#3d4432] ring-[#cfd5c0] dark:bg-[#2a3022] dark:text-[#dfe4d2] dark:ring-[#3d4432]"
          : "bg-stone-50 text-stone-600 ring-stone-200 dark:bg-stone-800 dark:text-stone-300 dark:ring-stone-700",
      )}
      title={RANK_HELP[system.toLowerCase() as keyof typeof RANK_HELP]}
    >
      <span className="text-[10px] font-medium uppercase tracking-wide opacity-70">{system}</span>
      <span className="font-semibold">{value}</span>
    </span>
  );
}

export function RankBadges({ venue }: { venue: Venue }) {
  const { ccf, core, thcpl } = venue.ranks;
  if (!ccf && !core && !thcpl) {
    return <span className="text-xs italic text-stone-400" title="Not ranked by CCF, CORE or THCPL in the source data">Unranked</span>;
  }
  return (
    <span className="flex flex-wrap gap-1.5">
      {core && <RankPill system="CORE" value={core} />}
      {ccf && <RankPill system="CCF" value={ccf} />}
      {thcpl && <RankPill system="THCPL" value={thcpl} />}
    </span>
  );
}

export function AcceptRateText({ venue }: { venue: Venue }) {
  const r = latestAcceptRate(venue);
  if (!r) return null;
  return (
    <span className="text-xs text-stone-500 dark:text-stone-400" title={r.submitted && r.accepted ? `${r.accepted} accepted of ${r.submitted} submitted` : undefined}>
      Acceptance <span className="font-semibold text-stone-700 dark:text-stone-200">{formatPercent(r.rate)}</span> ({r.year})
    </span>
  );
}

export function AreaTag({ venue }: { venue: Venue }) {
  return <span className="text-xs text-stone-500 dark:text-stone-400">{AREAS[venue.area]}</span>;
}

/** Self-updating countdown: every second inside 24 h, otherwise every 30 s. */
export function Countdown({ at, className }: { at: string; className?: string }) {
  const target = new Date(at).getTime();
  const [now, setNow] = useState(() => new Date());
  const close = target - now.getTime() < 86_400_000;
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), close ? 1000 : 30_000);
    return () => clearInterval(id);
  }, [close]);
  const days = (target - now.getTime()) / 86_400_000;
  const tone = days < 3 ? "text-[#a3542e] dark:text-[#e3a07c]" : days < 14 ? "text-[#8a6a2a] dark:text-[#d8bd7f]" : "text-brand-600 dark:text-brand-300";
  return (
    <span className={cx("font-semibold tabular-nums", tone, className)} aria-label={`Time left: ${formatCountdown(at, now)}`}>
      {formatCountdown(at, now)}
    </span>
  );
}
