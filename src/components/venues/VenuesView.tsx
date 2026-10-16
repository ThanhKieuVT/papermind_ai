"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useFollows, useNow, useVenues } from "@/hooks/useVenues";
import { AREAS, type AreaCode, type CcfRank, type CoreRank } from "@/lib/venues/types";
import {
  EMPTY_FILTERS,
  URGENCY_LABEL,
  filterStatuses,
  groupByUrgency,
  sortStatuses,
  venueStatus,
  type SortKey,
  type StatusFilter,
  type Urgency,
  type VenueFilters,
  type VenueStatus,
} from "@/lib/venues/schedule";
import { TIMEZONE_OPTIONS } from "@/lib/venues/format";
import { buildIcs } from "@/lib/venues/calendar";
import { toggleFollow } from "@/lib/venues/follow";
import { downloadText } from "@/lib/export/markdown";
import { Alert, Button, EmptyState, PageHeader, Spinner, cx, inputClass, labelClass } from "@/components/ui/primitives";
import { Dialog } from "@/components/ui/Dialog";
import { IconDownload, IconSearch } from "@/components/ui/icons";
import { VenueCard } from "@/components/venues/VenueCard";
import { VenueDetail } from "@/components/venues/VenueDetail";
import { milestoneEvent, statusEvents } from "@/components/venues/events";

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "upcoming", label: "Open now" },
  { value: "30d", label: "Next 30 days" },
  { value: "tba", label: "Not announced" },
  { value: "followed", label: "★ Following" },
  { value: "all", label: "All venues" },
];
const CCF: CcfRank[] = ["A", "B", "C"];
const CORE: CoreRank[] = ["A*", "A", "B", "C"];
const GROUP_ORDER: Urgency[] = ["week", "month", "later", "tba"];
const PAGE = 20;
const TZ_KEY = "papermind:venue-timezone";

function parseFilters(p: URLSearchParams): VenueFilters & { sort: SortKey } {
  const list = (k: string) => (p.get(k) ?? "").split(",").filter(Boolean);
  const status = p.get("status") as StatusFilter | null;
  const sort = p.get("sort") as SortKey | null;
  return {
    text: p.get("q") ?? "",
    status: status && STATUS_OPTIONS.some((o) => o.value === status) ? status : EMPTY_FILTERS.status,
    areas: list("area").filter((a): a is AreaCode => a in AREAS),
    ccf: list("ccf").filter((r): r is CcfRank => (CCF as string[]).includes(r)),
    core: list("core").filter((r): r is CoreRank => (CORE as string[]).includes(r)),
    sort: sort && ["deadline", "event", "accept", "name"].includes(sort) ? sort : "deadline",
  };
}

function Chip({ active, onClick, children, title }: { active: boolean; onClick: () => void; children: React.ReactNode; title?: string }) {
  return (
    <button
      type="button"
      title={title}
      aria-pressed={active}
      onClick={onClick}
      className={cx(
        "rounded-full px-3 py-1 text-[13px] font-medium ring-1 ring-inset transition",
        active
          ? "bg-brand-600 text-white ring-brand-600 dark:bg-brand-500 dark:ring-brand-500"
          : "bg-white text-stone-600 ring-stone-200 hover:bg-stone-50 dark:bg-stone-900 dark:text-stone-300 dark:ring-stone-700 dark:hover:bg-stone-800",
      )}
    >
      {children}
    </button>
  );
}

export function VenuesView() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const state = useVenues();
  const follows = useFollows();
  const now = useNow(60_000);
  const [zone, setZone] = useState("local");
  const [openId, setOpenId] = useState<string | null>(null);
  const [shown, setShown] = useState<Record<Urgency, number>>({ week: PAGE, month: PAGE, later: PAGE, tba: PAGE });
  const [text, setText] = useState(params.get("q") ?? "");

  const filters = parseFilters(new URLSearchParams(params.toString()));

  useEffect(() => {
    try {
      const saved = localStorage.getItem(TZ_KEY);
      if (saved && TIMEZONE_OPTIONS.some((o) => o.value === saved)) setZone(saved);
    } catch {
      // ignore
    }
  }, []);

  const update = (patch: Partial<VenueFilters & { sort: SortKey }>) => {
    const next = { ...filters, ...patch };
    const p = new URLSearchParams();
    if (next.text) p.set("q", next.text);
    if (next.status !== EMPTY_FILTERS.status) p.set("status", next.status);
    if (next.areas.length) p.set("area", next.areas.join(","));
    if (next.ccf.length) p.set("ccf", next.ccf.join(","));
    if (next.core.length) p.set("core", next.core.join(","));
    if (next.sort !== "deadline") p.set("sort", next.sort);
    router.replace(p.size ? `${pathname}?${p.toString()}` : pathname, { scroll: false });
    setShown({ week: PAGE, month: PAGE, later: PAGE, tba: PAGE });
  };

  // Debounce free-text search into the URL.
  useEffect(() => {
    if (text === filters.text) return;
    const id = setTimeout(() => update({ text }), 250);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to typing
  }, [text]);

  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  // Recompute statuses at most once a minute (cards run their own live countdowns).
  const minute = Math.floor(now.getTime() / 60_000);
  const statuses = useMemo<VenueStatus[]>(
    () => (state.status === "ready" ? state.data.venues.map((v) => venueStatus(v, new Date(minute * 60_000))) : []),
    [state, minute],
  );
  const visible = useMemo(
    () => sortStatuses(filterStatuses(statuses, filters, follows, now), filters.sort),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `filters` is derived from the URL string
    [statuses, params.toString(), follows, minute],
  );
  const groups = groupByUrgency(visible);
  const grouped = filters.sort === "deadline";
  const open = statuses.find((s) => s.venue.id === openId) ?? null;
  const soon = statuses.filter((s) => s.urgency === "week").length;

  const exportVisible = () => {
    const events = statusEvents(visible);
    if (events.length === 0) return;
    downloadText(`papermind-deadlines-${new Date().toISOString().slice(0, 10)}.ics`, buildIcs(events), "text/calendar");
  };

  const activeCount = filters.areas.length + filters.ccf.length + filters.core.length + (filters.text ? 1 : 0);

  const renderCards = (items: VenueStatus[], key: Urgency | "all") => {
    const limit = key === "all" ? Math.max(...Object.values(shown)) : shown[key];
    return (
      <>
        <ul className="space-y-3">
          {items.slice(0, limit).map((s) => (
            <li key={s.venue.id}>
              <VenueCard
                status={s}
                zone={zone}
                followed={follows.has(s.venue.id)}
                onToggleFollow={() => toggleFollow(s.venue.id)}
                onOpen={() => setOpenId(s.venue.id)}
                onDownloadIcs={() => {
                  if (!s.edition) return;
                  const events = s.upcoming.map((m) => milestoneEvent(s.venue, s.edition!, m));
                  downloadText(`${s.venue.acronym}-${s.edition.year}.ics`, buildIcs(events), "text/calendar");
                }}
              />
            </li>
          ))}
        </ul>
        {items.length > limit && (
          <div className="mt-3 text-center">
            <Button variant="secondary" onClick={() => setShown((sh) => (key === "all" ? { week: limit + PAGE, month: limit + PAGE, later: limit + PAGE, tba: limit + PAGE } : { ...sh, [key]: sh[key] + PAGE }))}>
              Show {Math.min(PAGE, items.length - limit)} more
            </Button>
          </div>
        )}
      </>
    );
  };

  return (
    <>
      <PageHeader
        title="Venues & Deadlines"
        description="Submission deadlines, rankings (CORE, CCF, THCPL) and acceptance rates for computer-science conferences. Times are converted from each venue's published timezone."
        actions={
          <Button variant="secondary" onClick={exportVisible} disabled={statusEvents(visible).length === 0}>
            <IconDownload size={16} /> Export shown to calendar
          </Button>
        }
      />

      {state.status === "loading" && <Spinner label="Loading venues…" />}
      {state.status === "error" && <Alert tone="error" title="Could not load venues">{state.message}</Alert>}

      {state.status === "ready" && (
        <>
          <div className="mb-6 space-y-4 rounded-2xl border border-stone-200/80 bg-white p-5 shadow-sm dark:border-stone-800 dark:bg-stone-900">
            <div className="grid gap-3 md:grid-cols-[1fr_15rem_12rem]">
              <div>
                <label htmlFor="venue-search" className={labelClass}>Search</label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"><IconSearch size={17} /></span>
                  <input id="venue-search" type="search" className={`${inputClass} pl-10`} value={text} onChange={(e) => setText(e.target.value)} placeholder="Acronym, full name, city… e.g. NeurIPS, vision, Vienna" />
                </div>
              </div>
              <div>
                <label htmlFor="venue-tz" className={labelClass}>Show times in</label>
                <select
                  id="venue-tz"
                  className={inputClass}
                  value={zone}
                  onChange={(e) => {
                    setZone(e.target.value);
                    try {
                      localStorage.setItem(TZ_KEY, e.target.value);
                    } catch {
                      // ignore
                    }
                  }}
                >
                  {TIMEZONE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="venue-sort" className={labelClass}>Sort by</label>
                <select id="venue-sort" className={inputClass} value={filters.sort} onChange={(e) => update({ sort: e.target.value as SortKey })}>
                  <option value="deadline">Next deadline</option>
                  <option value="event">Conference date</option>
                  <option value="accept">Most selective</option>
                  <option value="name">Name (A–Z)</option>
                </select>
              </div>
            </div>

            <div className="flex flex-wrap gap-2" role="group" aria-label="Deadline status">
              {STATUS_OPTIONS.map((o) => (
                <Chip key={o.value} active={filters.status === o.value} onClick={() => update({ status: o.value })}>
                  {o.label}{o.value === "followed" ? ` (${follows.size})` : ""}
                </Chip>
              ))}
            </div>

            <div className="grid gap-4 border-t border-stone-100 pt-4 dark:border-stone-800 lg:grid-cols-[1fr_auto]">
              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-stone-400">Research area</p>
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="Research area">
                  {(Object.keys(AREAS) as AreaCode[]).map((a) => (
                    <Chip key={a} active={filters.areas.includes(a)} onClick={() => update({ areas: toggle(filters.areas, a) })}>{AREAS[a]}</Chip>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-stone-400" title="A venue matches if it has any of the selected ranks">Ranking (any match)</p>
                <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="CORE rank">
                  <span className="w-11 text-xs text-stone-500">CORE</span>
                  {CORE.map((r) => <Chip key={r} active={filters.core.includes(r)} onClick={() => update({ core: toggle(filters.core, r) })}>{r}</Chip>)}
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5" role="group" aria-label="CCF rank">
                  <span className="w-11 text-xs text-stone-500">CCF</span>
                  {CCF.map((r) => <Chip key={r} active={filters.ccf.includes(r)} onClick={() => update({ ccf: toggle(filters.ccf, r) })}>{r}</Chip>)}
                </div>
              </div>
            </div>
          </div>

          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-sm text-stone-500 dark:text-stone-400">
            <p aria-live="polite">
              <span className="font-semibold text-stone-900 dark:text-white">{visible.length}</span> of {statuses.length} venues
              {soon > 0 && <> · <span className="font-medium text-[#a3542e] dark:text-[#e3a07c]">{soon} due within 7 days</span></>}
            </p>
            {activeCount > 0 && (
              <button type="button" className="text-sm font-medium text-brand-700 hover:underline dark:text-brand-300" onClick={() => { setText(""); update({ ...EMPTY_FILTERS, status: filters.status }); }}>
                Clear {activeCount} filter{activeCount > 1 ? "s" : ""}
              </button>
            )}
          </div>

          {visible.length === 0 && (
            <EmptyState title={filters.status === "followed" ? "You aren't following any venues yet" : "No venues match"}>
              {filters.status === "followed" ? "Tap “Follow” on any venue to keep its deadlines here." : "Try fewer filters or a different search."}
            </EmptyState>
          )}

          {visible.length > 0 && grouped &&
            GROUP_ORDER.filter((g) => groups[g].length > 0).map((g) => (
              <section key={g} className="mb-8" aria-labelledby={`group-${g}`}>
                <h2 id={`group-${g}`} className="mb-3 flex items-center gap-2 text-sm font-semibold text-stone-900 dark:text-white">
                  {URGENCY_LABEL[g]}
                  <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-600 dark:bg-stone-800 dark:text-stone-300">{groups[g].length}</span>
                </h2>
                {renderCards(groups[g], g)}
              </section>
            ))}
          {visible.length > 0 && !grouped && renderCards(visible, "all")}

          <p className="mt-8 border-t border-stone-200 pt-4 text-xs leading-relaxed text-stone-400 dark:border-stone-800">
            Data: <a className="underline" href={state.data.source} target="_blank" rel="noopener noreferrer">ccfddl/ccf-deadlines</a> ({state.data.license}), a community-maintained dataset, last updated{" "}
            {new Date(state.data.syncedAt).toLocaleString()}. Estimates for unannounced deadlines are based on previous editions and are not official. Always confirm dates on the official call for papers.
          </p>

          <Dialog open={open !== null} onClose={() => setOpenId(null)} title={open ? `${open.venue.acronym}: ${open.venue.name}` : "Venue"} wide>
            {open && <VenueDetail status={open} zone={zone} />}
          </Dialog>
        </>
      )}
    </>
  );
}
