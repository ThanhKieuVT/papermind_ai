"use client";

import Link from "next/link";
import { useEffect, useState, type ComponentType } from "react";
import { useLibrary } from "@/hooks/useLibrary";
import { useAiStatus } from "@/hooks/useAiStatus";
import { listDocuments } from "@/lib/storage/library";
import { listDecks } from "@/lib/storage/study";
import { Alert, Badge, Card, Spinner } from "@/components/ui/primitives";
import { formatAuthors } from "@/components/papers/PaperMeta";
import { UpcomingDeadlines } from "@/components/venues/UpcomingDeadlines";
import { CatWithClover, Clover } from "@/components/ui/illustrations";
import {
  IconArrowRight,
  IconBookOpen,
  IconBookmark,
  IconCap,
  IconCheck,
  IconCompare,
  IconFile,
  IconLibrary,
  IconSearch,
  IconSparkles,
} from "@/components/ui/icons";

type Icon = ComponentType<{ size?: number }>;

const ACTIONS: { href: string; title: string; text: string; icon: Icon; tint: string }[] = [
  { href: "/discover", title: "Discover papers", text: "Search millions of works on OpenAlex.", icon: IconSearch, tint: "bg-[#e9ecdf] text-[#5c6748] dark:bg-[#2a3022] dark:text-[#b0b99a]" },
  { href: "/reader", title: "Read a PDF", text: "Render, extract and ask questions.", icon: IconBookOpen, tint: "bg-[#f1e7dc] text-[#9a6b4b] dark:bg-[#33281f] dark:text-[#d6b49a]" },
  { href: "/compare", title: "Compare papers", text: "Side-by-side structured table.", icon: IconCompare, tint: "bg-[#e3ebe6] text-[#4f6e60] dark:bg-[#22302a] dark:text-[#a7c2b5]" },
  { href: "/study", title: "Study", text: "Flashcards and quizzes.", icon: IconCap, tint: "bg-[#f3ecd9] text-[#8a7240] dark:bg-[#332d1d] dark:text-[#d7c49a]" },
];

const STATUS_TONE = { unread: "neutral", reading: "blue", completed: "green" } as const;

export function DashboardView() {
  const { entries, loading, error } = useLibrary();
  const ai = useAiStatus();
  const [counts, setCounts] = useState<{ docs: number; decks: number } | null>(null);

  useEffect(() => {
    Promise.all([listDocuments(), listDecks()])
      .then(([docs, decks]) => setCounts({ docs: docs.length, decks: decks.length }))
      .catch(() => setCounts(null));
  }, []);

  const byStatus = (s: string) => entries.filter((e) => e.status === s).length;
  const stats: { label: string; value: number | string; icon: Icon }[] = [
    { label: "Saved papers", value: entries.length, icon: IconBookmark },
    { label: "Reading", value: byStatus("reading"), icon: IconBookOpen },
    { label: "Completed", value: byStatus("completed"), icon: IconCheck },
    { label: "PDFs stored", value: counts?.docs ?? "—", icon: IconFile },
    { label: "Study decks", value: counts?.decks ?? "—", icon: IconCap },
  ];

  return (
    <>
      <section className="relative mb-8 overflow-hidden rounded-3xl border border-brand-200/70 bg-gradient-to-br from-[#f1f2ea] via-[#e9ecdf] to-[#dfe4d2] px-6 py-8 shadow-[0_8px_30px_-12px_rgba(74,83,59,0.25)] dark:border-brand-900 dark:from-[#262b20] dark:via-[#20251b] dark:to-[#1a1e16] sm:px-10 sm:py-10">
        <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-20 h-72 w-72 rounded-full bg-[#f6efe0] opacity-70 blur-3xl dark:bg-[#3a3a2a]/40" />
        <Clover size={40} leaf="#93a37a" vein="#4a533b" className="pointer-events-none absolute right-[36%] top-7 hidden rotate-12 opacity-50 md:block" />
        <Clover size={26} leaf="#a9b693" vein="#4a533b" className="pointer-events-none absolute bottom-7 right-[31%] hidden -rotate-12 opacity-40 md:block" />
        <Clover size={20} leaf="#a9b693" vein="#4a533b" className="pointer-events-none absolute right-8 top-6 hidden rotate-45 opacity-50 md:block" />
        <CatWithClover className="pointer-events-none absolute -bottom-3 right-6 hidden h-56 w-56 md:block lg:right-14" />
        <h1 className="relative text-sm font-medium text-brand-600 dark:text-brand-300">Dashboard</h1>
        <h2 className="relative mt-1 max-w-2xl text-2xl font-semibold tracking-tight text-stone-900 dark:text-stone-50 sm:text-3xl">Read smarter. Understand deeper.</h2>
        <p className="relative mt-2 max-w-xl text-[15px] leading-relaxed text-stone-600 dark:text-stone-300">
          Find papers, read them with an AI assistant that cites its sources, compare methods and turn what you learn into flashcards.
        </p>
        <div className="relative mt-6 flex flex-wrap gap-3">
          <Link href="/discover" className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 dark:bg-brand-500 dark:hover:bg-brand-400">
            <IconSearch size={16} /> Find papers
          </Link>
          <Link href="/reader" className="inline-flex items-center gap-2 rounded-lg bg-white/70 px-4 py-2.5 text-sm font-semibold text-stone-700 ring-1 ring-inset ring-stone-300/70 transition hover:bg-white dark:bg-white/5 dark:text-stone-200 dark:ring-stone-600 dark:hover:bg-white/10">
            <IconBookOpen size={16} /> Open a PDF
          </Link>
        </div>
      </section>

      {error && <Alert tone="error" className="mb-4">{error}</Alert>}

      <section aria-label="Statistics" className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-5">
        {stats.map(({ label, value, icon: StatIcon }) => (
          <Card key={label} className="!p-4">
            <div className="flex items-center justify-between">
              <p className="text-[13px] font-medium text-stone-500 dark:text-stone-400">{label}</p>
              <span className="text-stone-300 dark:text-stone-600"><StatIcon size={16} /></span>
            </div>
            <p className="mt-2 text-3xl font-semibold tracking-tight">{loading ? "…" : value}</p>
          </Card>
        ))}
      </section>

      <div className="mb-8">
        <UpcomingDeadlines />
      </div>

      <section aria-labelledby="quick-actions" className="mb-8">
        <h2 id="quick-actions" className="mb-3 text-sm font-semibold text-stone-900 dark:text-white">Quick actions</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {ACTIONS.map(({ href, title, text, icon: ActionIcon, tint }) => (
            <Link
              key={href}
              href={href}
              className="group rounded-2xl border border-stone-200/80 bg-white p-5 transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-lg hover:shadow-brand-600/5 dark:border-stone-800 dark:bg-stone-900 dark:hover:border-brand-500/50"
            >
              <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${tint}`}><ActionIcon size={20} /></span>
              <p className="mt-4 flex items-center gap-1.5 font-semibold text-stone-900 dark:text-white">
                {title}
                <span className="text-stone-300 transition group-hover:translate-x-0.5 group-hover:text-brand-600 dark:text-stone-600"><IconArrowRight size={16} /></span>
              </p>
              <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">{text}</p>
            </Link>
          ))}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">Recently saved</h2>
            {entries.length > 0 && (
              <Link href="/library" className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-300">View library</Link>
            )}
          </div>
          {loading && <Spinner label="Loading…" />}
          {!loading && entries.length === 0 && (
            <div className="flex items-center gap-4 rounded-xl bg-stone-50 p-4 dark:bg-stone-800/50">
              <span className="text-stone-400"><IconLibrary size={22} /></span>
              <p className="text-sm text-stone-600 dark:text-stone-300">
                Nothing saved yet. <Link href="/discover" className="font-medium text-brand-600 hover:underline dark:text-brand-300">Find your first paper →</Link>
              </p>
            </div>
          )}
          <ul className="-mx-2 divide-y divide-stone-100 dark:divide-stone-800">
            {entries.slice(0, 6).map((e) => (
              <li key={e.paper.id}>
                <Link href={`/reader?paper=${encodeURIComponent(e.paper.id)}`} className="flex items-start justify-between gap-3 rounded-lg px-2 py-3 hover:bg-stone-50 dark:hover:bg-stone-800/60">
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-stone-900 dark:text-white">{e.paper.title}</span>
                    <span className="block truncate text-xs text-stone-500">{formatAuthors(e.paper.authors, 2)}{e.paper.year ? ` · ${e.paper.year}` : ""}</span>
                  </span>
                  <Badge tone={STATUS_TONE[e.status]}>{e.status}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <div className="mb-4 flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-400 to-brand-700 text-white"><IconSparkles size={16} /></span>
            <h2 className="font-semibold">AI assistant</h2>
          </div>
          {ai.loading ? (
            <Spinner label="Checking…" />
          ) : ai.status?.enabled ? (
            <div className="space-y-2 text-sm">
              <p><Badge tone="green">● Enabled</Badge></p>
              <p className="text-stone-600 dark:text-stone-300">Model: <span className="font-medium text-stone-900 dark:text-white">{ai.status.model}</span></p>
              {ai.status.requiresToken && <p className="text-stone-500">Requires an access token (Settings).</p>}
              <p className="text-stone-500 dark:text-stone-400">Answers separate what the paper says from background and interpretation.</p>
            </div>
          ) : (
            <div className="space-y-2 text-sm">
              <p><Badge tone="amber">Disabled</Badge></p>
              <p className="text-stone-600 dark:text-stone-300">{ai.status?.reason ?? "Status unavailable."}</p>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
