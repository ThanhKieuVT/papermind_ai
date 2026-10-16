"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useFollows, useNow, useVenues } from "@/hooks/useVenues";
import { AREAS, type AreaCode, type CcfRank, type CoreRank } from "@/lib/venues/types";
import {
  EMPTY_FILTERS,
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
import { REGIONS, countryName, parseHostLocation, type Region } from "@/lib/venues/location";
import { TIMEZONE_LABELS_VI, VENUE_TEXT, useVenueLang, type Lang, type VenueText } from "@/lib/venues/i18n";
import { buildIcs } from "@/lib/venues/calendar";
import { toggleFollow } from "@/lib/venues/follow";
import { downloadText } from "@/lib/export/markdown";
import { Alert, Button, EmptyState, Spinner, cx, inputClass, labelClass } from "@/components/ui/primitives";
import { Dialog } from "@/components/ui/Dialog";
import { IconDownload, IconSearch } from "@/components/ui/icons";
import { VenueCard, VenueTable } from "@/components/venues/VenueCard";
import { VenueDetail } from "@/components/venues/VenueDetail";
import { milestoneEvent, statusEvents } from "@/components/venues/events";

const STATUSES: StatusFilter[] = ["upcoming", "30d", "tba", "followed", "all"];
const SORTS: SortKey[] = ["deadline", "event", "accept", "name"];
const CCF: CcfRank[] = ["A", "B", "C"];
const CORE: CoreRank[] = ["A*", "A", "B", "C"];
const GROUP_ORDER: Urgency[] = ["week", "month", "later", "tba"];
const PAGE = 20;
const TZ_KEY = "papermind:venue-timezone";
const VIEW_KEY = "papermind:venues-view";

type View = "cards" | "compact";
type Filters = VenueFilters & { sort: SortKey };

function parseFilters(p: URLSearchParams): Filters {
  const list = (k: string) => (p.get(k) ?? "").split(",").filter(Boolean);
  const status = p.get("status") as StatusFilter | null;
  const sort = p.get("sort") as SortKey | null;
  return {
    text: p.get("q") ?? "",
    status: status && STATUSES.includes(status) ? status : EMPTY_FILTERS.status,
    areas: list("area").filter((a): a is AreaCode => a in AREAS),
    ccf: list("ccf").filter((r): r is CcfRank => (CCF as string[]).includes(r)),
    core: list("core").filter((r): r is CoreRank => (CORE as string[]).includes(r)),
    regions: list("region").filter((r): r is Region => (REGIONS as string[]).includes(r)),
    countries: list("country").filter((c) => /^[A-Z]{2}$/.test(c)),
    sort: sort && SORTS.includes(sort) ? sort : "deadline",
  };
}

function usePersisted<T extends string>(key: string, initial: T, allowed: readonly T[]): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(initial);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(key);
      if (saved && (allowed as readonly string[]).includes(saved)) setValue(saved as T);
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- read once
  }, [key]);
  const update = (v: T) => {
    setValue(v);
    try {
      localStorage.setItem(key, v);
    } catch {
      // ignore
    }
  };
  return [value, update];
}

function Chip({ active, onClick, children, title }: { active: boolean; onClick: () => void; children: ReactNode; title?: string }) {
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

function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg bg-white p-1 ring-1 ring-stone-200 dark:bg-stone-900 dark:ring-stone-700">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            "rounded-md px-2.5 py-1 text-[13px] font-medium transition",
            value === o.value ? "bg-brand-600 text-white dark:bg-brand-500" : "text-stone-600 hover:text-stone-900 dark:text-stone-300",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

/** Area, ranking and location filters (inline on desktop, in a sheet on mobile). */
function FilterControls({ filters, update, t, countries }: { filters: Filters; update: (p: Partial<Filters>) => void; t: VenueText; countries: { code: string; name: string; count: number }[] }) {
  const heading = "mb-2 text-[11px] font-semibold uppercase tracking-wider text-stone-400";
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_auto]">
      <div className="space-y-4">
        <div>
          <p className={heading}>{t.researchArea}</p>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={t.researchArea}>
            {(Object.keys(AREAS) as AreaCode[]).map((a) => (
              <Chip key={a} active={filters.areas.includes(a)} onClick={() => update({ areas: toggle(filters.areas, a) })}>{t.areas[a]}</Chip>
            ))}
          </div>
        </div>
        <div>
          <p className={heading}>{t.hostRegion}</p>
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={t.hostRegion}>
            {REGIONS.map((r) => (
              <Chip key={r} active={filters.regions.includes(r)} onClick={() => update({ regions: toggle(filters.regions, r) })}>{t.regions[r]}</Chip>
            ))}
            <label htmlFor="venue-country" className="sr-only">{t.country}</label>
            <select
              id="venue-country"
              className="rounded-full border-0 bg-white px-3 py-1 text-[13px] text-stone-700 ring-1 ring-inset ring-stone-200 dark:bg-stone-900 dark:text-stone-200 dark:ring-stone-700"
              value={filters.countries[0] ?? ""}
              onChange={(e) => update({ countries: e.target.value ? [e.target.value] : [] })}
            >
              <option value="">{t.allCountries}</option>
              {countries.map((c) => <option key={c.code} value={c.code}>{c.name} ({c.count})</option>)}
            </select>
          </div>
        </div>
      </div>
      <div>
        <p className={heading} title={t.rankingHint}>{t.ranking}</p>
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
  );
}

export function VenuesView() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const state = useVenues();
  const follows = useFollows();
  const now = useNow(60_000);
  const [lang, setLang] = useVenueLang();
  const t = VENUE_TEXT[lang];
  const [zone, setZone] = usePersisted(TZ_KEY, "local", TIMEZONE_OPTIONS.map((o) => o.value));
  const [view, setView] = usePersisted<View>(VIEW_KEY, "cards", ["cards", "compact"]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [shown, setShown] = useState<Record<Urgency | "all", number>>({ week: PAGE, month: PAGE, later: PAGE, tba: PAGE, all: PAGE });
  const [text, setText] = useState(params.get("q") ?? "");

  const paramString = params.toString();
  const filters = useMemo(() => parseFilters(new URLSearchParams(paramString)), [paramString]);

  const update = (patch: Partial<Filters>) => {
    const next = { ...filters, ...patch };
    const p = new URLSearchParams();
    if (next.text) p.set("q", next.text);
    if (next.status !== EMPTY_FILTERS.status) p.set("status", next.status);
    if (next.areas.length) p.set("area", next.areas.join(","));
    if (next.ccf.length) p.set("ccf", next.ccf.join(","));
    if (next.core.length) p.set("core", next.core.join(","));
    if (next.regions.length) p.set("region", next.regions.join(","));
    if (next.countries.length) p.set("country", next.countries.join(","));
    if (next.sort !== "deadline") p.set("sort", next.sort);
    router.replace(p.size ? `${pathname}?${p.toString()}` : pathname, { scroll: false });
    setShown({ week: PAGE, month: PAGE, later: PAGE, tba: PAGE, all: PAGE });
  };

  // Debounce free-text search into the URL.
  useEffect(() => {
    if (text === filters.text) return;
    const id = setTimeout(() => update({ text }), 250);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to typing
  }, [text]);

  // Recompute statuses at most once a minute (cards run their own live countdowns).
  const minute = Math.floor(now.getTime() / 60_000);
  const statuses = useMemo<VenueStatus[]>(
    () => (state.status === "ready" ? state.data.venues.map((v) => venueStatus(v, new Date(minute * 60_000))) : []),
    [state, minute],
  );
  const visible = useMemo(
    () => sortStatuses(filterStatuses(statuses, filters, follows, new Date(minute * 60_000)), filters.sort),
    [statuses, filters, follows, minute],
  );
  const countries = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of statuses) {
      const c = parseHostLocation(s.edition?.place).country;
      if (c) counts.set(c, (counts.get(c) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([code, count]) => ({ code, count, name: countryName(code, t.locale) }))
      .sort((a, b) => a.name.localeCompare(b.name, t.locale));
  }, [statuses, t.locale]);

  const groups = groupByUrgency(visible);
  const grouped = filters.sort === "deadline";
  const open = statuses.find((s) => s.venue.id === openId) ?? null;
  const soon = statuses.filter((s) => s.urgency === "week").length;
  const panelCount = filters.areas.length + filters.ccf.length + filters.core.length + filters.regions.length + filters.countries.length;
  const activeCount = panelCount + (filters.text ? 1 : 0);
  const tzLabel = (value: string, en: string) => (lang === "vi" ? TIMEZONE_LABELS_VI[value] ?? en : en);

  const exportVisible = () => {
    const events = statusEvents(visible, t);
    if (events.length) downloadText(`papermind-deadlines-${new Date().toISOString().slice(0, 10)}.ics`, buildIcs(events), "text/calendar");
  };

  const renderItems = (items: VenueStatus[], key: Urgency | "all") => {
    const limit = shown[key];
    const slice = items.slice(0, limit);
    return (
      <>
        {view === "compact" ? (
          <VenueTable items={slice} zone={zone} t={t} followed={follows} onToggleFollow={toggleFollow} onOpen={setOpenId} />
        ) : (
          <ul className="space-y-3">
            {slice.map((s) => (
              <li key={s.venue.id}>
                <VenueCard
                  status={s}
                  zone={zone}
                  t={t}
                  followed={follows.has(s.venue.id)}
                  onToggleFollow={() => toggleFollow(s.venue.id)}
                  onOpen={() => setOpenId(s.venue.id)}
                  onDownloadIcs={() => {
                    if (!s.edition) return;
                    const events = s.upcoming.map((m) => milestoneEvent(s.venue, s.edition!, m, t));
                    downloadText(`${s.venue.acronym}-${s.edition.year}.ics`, buildIcs(events), "text/calendar");
                  }}
                />
              </li>
            ))}
          </ul>
        )}
        {items.length > limit && (
          <div className="mt-3 text-center">
            <Button variant="secondary" onClick={() => setShown((sh) => ({ ...sh, [key]: sh[key] + PAGE }))}>
              {t.showMore(Math.min(PAGE, items.length - limit))}
            </Button>
          </div>
        )}
      </>
    );
  };

  return (
    <div lang={lang}>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-stone-900 dark:text-white">{t.title}</h1>
          <p className="mt-1.5 max-w-3xl text-[15px] leading-relaxed text-stone-500 dark:text-stone-400">{t.description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented<Lang> label={t.language} value={lang} onChange={setLang} options={[{ value: "en", label: "EN" }, { value: "vi", label: "VI" }]} />
          <Button variant="secondary" onClick={exportVisible} disabled={statusEvents(visible).length === 0}>
            <IconDownload size={16} /> <span className="hidden sm:inline">{t.exportShown}</span><span className="sm:hidden">.ics</span>
          </Button>
        </div>
      </div>

      {state.status === "loading" && <Spinner label="…" />}
      {state.status === "error" && <Alert tone="error">{state.message}</Alert>}

      {state.status === "ready" && (
        <>
          <div className="mb-6 space-y-4 rounded-2xl border border-stone-200/80 bg-white p-4 shadow-sm dark:border-stone-800 dark:bg-stone-900 sm:p-5">
            <div className="grid gap-3 md:grid-cols-[1fr_15rem_12rem]">
              <div>
                <label htmlFor="venue-search" className={labelClass}>{t.search}</label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"><IconSearch size={17} /></span>
                  <input id="venue-search" type="search" className={`${inputClass} pl-10`} value={text} onChange={(e) => setText(e.target.value)} placeholder={t.searchPlaceholder} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 md:contents">
                <div>
                  <label htmlFor="venue-tz" className={labelClass}>{t.showTimesIn}</label>
                  <select id="venue-tz" className={inputClass} value={zone} onChange={(e) => setZone(e.target.value)}>
                    {TIMEZONE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{tzLabel(o.value, o.label)}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="venue-sort" className={labelClass}>{t.sortBy}</label>
                  <select id="venue-sort" className={inputClass} value={filters.sort} onChange={(e) => update({ sort: e.target.value as SortKey })}>
                    {SORTS.map((k) => <option key={k} value={k}>{t.sort[k]}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible" role="group" aria-label={t.statusGroup}>
              {STATUSES.map((s) => (
                <span key={s} className="shrink-0">
                  <Chip active={filters.status === s} onClick={() => update({ status: s })}>
                    {t.status[s]}{s === "followed" ? ` (${follows.size})` : ""}
                  </Chip>
                </span>
              ))}
            </div>

            <div className="flex items-center justify-between md:hidden">
              <Button variant="secondary" size="sm" onClick={() => setSheetOpen(true)} aria-haspopup="dialog">
                {t.filters}{panelCount > 0 ? ` (${panelCount})` : ""}
              </Button>
              <Segmented<View> label={t.viewLabel} value={view} onChange={setView} options={[{ value: "cards", label: t.view.cards }, { value: "compact", label: t.view.compact }]} />
            </div>

            <div className="hidden border-t border-stone-100 pt-4 dark:border-stone-800 md:block">
              <FilterControls filters={filters} update={update} t={t} countries={countries} />
            </div>
          </div>

          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-sm text-stone-500 dark:text-stone-400">
            <p aria-live="polite">
              <span className="font-semibold text-stone-900 dark:text-white">{t.count(visible.length, statuses.length)}</span>
              {soon > 0 && <> · <span className="font-medium text-[#a3542e] dark:text-[#e3a07c]">{t.dueSoon(soon)}</span></>}
            </p>
            <div className="flex items-center gap-3">
              {activeCount > 0 && (
                <button type="button" className="text-sm font-medium text-brand-700 hover:underline dark:text-brand-300" onClick={() => { setText(""); update({ ...EMPTY_FILTERS, status: filters.status, sort: filters.sort }); }}>
                  {t.clearFilters(activeCount)}
                </button>
              )}
              <span className="hidden md:inline-flex">
                <Segmented<View> label={t.viewLabel} value={view} onChange={setView} options={[{ value: "cards", label: t.view.cards }, { value: "compact", label: t.view.compact }]} />
              </span>
            </div>
          </div>

          {visible.length === 0 && (
            <EmptyState title={filters.status === "followed" ? t.noFollowsTitle : t.noMatchTitle}>
              {filters.status === "followed" ? t.noFollowsBody : t.noMatchBody}
            </EmptyState>
          )}

          {visible.length > 0 && grouped &&
            GROUP_ORDER.filter((g) => groups[g].length > 0).map((g) => (
              <section key={g} className="mb-8" aria-labelledby={`group-${g}`}>
                <h2 id={`group-${g}`} className="mb-3 flex items-center gap-2 text-sm font-semibold text-stone-900 dark:text-white">
                  {t.urgency[g]}
                  <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-600 dark:bg-stone-800 dark:text-stone-300">{groups[g].length}</span>
                </h2>
                {renderItems(groups[g], g)}
              </section>
            ))}
          {visible.length > 0 && !grouped && renderItems(visible, "all")}

          <p className="mt-8 border-t border-stone-200 pt-4 text-xs leading-relaxed text-stone-400 dark:border-stone-800">
            {t.dataLabel} <a className="underline" href={state.data.source} target="_blank" rel="noopener noreferrer">ccfddl/ccf-deadlines</a> ({state.data.license}), {t.footer(new Date(state.data.syncedAt).toLocaleString(t.locale))}
          </p>

          <Dialog open={sheetOpen} onClose={() => setSheetOpen(false)} title={t.filters}>
            <FilterControls filters={filters} update={update} t={t} countries={countries} />
            <div className="sticky bottom-0 -mx-6 mt-6 border-t border-stone-200 bg-white px-6 pt-4 dark:border-stone-700 dark:bg-stone-900">
              <Button className="w-full" onClick={() => setSheetOpen(false)}>{t.showResults(visible.length)}</Button>
            </div>
          </Dialog>

          <Dialog open={open !== null} onClose={() => setOpenId(null)} title={open ? `${open.venue.acronym}: ${open.venue.name}` : ""} wide>
            {open && <VenueDetail status={open} zone={zone} t={t} />}
          </Dialog>
        </>
      )}
    </div>
  );
}
