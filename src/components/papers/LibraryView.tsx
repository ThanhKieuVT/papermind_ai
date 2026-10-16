"use client";

import Link from "next/link";
import { useMemo, useRef, useState, type ChangeEvent } from "react";
import type { LibraryEntry, ReadingStatus } from "@/types/paper";
import { useLibrary } from "@/hooks/useLibrary";
import { filterLibrary, removePaper, updateEntry } from "@/lib/storage/library";
import { importLibraryJson } from "@/lib/storage/backup";
import { downloadText, libraryToJson, libraryToMarkdown } from "@/lib/export/markdown";
import { errorMessage } from "@/lib/api/client";
import { Alert, Badge, Button, Card, EmptyState, PageHeader, Spinner, inputClass, labelClass } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/Toast";
import { PaperBadges, SourceLinks, formatAuthors } from "@/components/papers/PaperMeta";

const STATUS_LABEL: Record<ReadingStatus, string> = { unread: "Unread", reading: "Reading", completed: "Completed" };
const STATUS_TONE: Record<ReadingStatus, "neutral" | "blue" | "green"> = { unread: "neutral", reading: "blue", completed: "green" };

export function LibraryView() {
  const { entries, loading, error } = useLibrary();
  const notify = useToast();
  const importInput = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [tag, setTag] = useState("");
  const [year, setYear] = useState("");
  const [status, setStatus] = useState<ReadingStatus | "">("");

  const allTags = useMemo(() => [...new Set(entries.flatMap((e) => e.tags))].sort(), [entries]);
  const allYears = useMemo(
    () => [...new Set(entries.map((e) => e.paper.year).filter((y): y is number => y !== null))].sort((a, b) => b - a),
    [entries],
  );
  const visible = filterLibrary(entries, { text, tag: tag || null, year: year ? Number(year) : null, status: status || null });

  const stamp = new Date().toISOString().slice(0, 10);

  const onImport = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const result = await importLibraryJson(await file.text());
      notify(`Imported ${result.imported} paper(s); ${result.skipped} skipped (duplicates or invalid).`, "info");
    } catch (err) {
      notify(errorMessage(err), "error");
    }
  };

  return (
    <>
      <PageHeader
        title="My Library"
        description="Your saved papers, notes and tags."
        actions={
          <>
            <Button variant="secondary" disabled={entries.length === 0} onClick={() => downloadText(`papermind-library-${stamp}.md`, libraryToMarkdown(visible))}>
              Export Markdown
            </Button>
            <Button variant="secondary" disabled={entries.length === 0} onClick={() => downloadText(`papermind-library-${stamp}.json`, libraryToJson(entries), "application/json")}>
              Export JSON
            </Button>
            <input ref={importInput} type="file" accept="application/json,.json" className="sr-only" onChange={onImport} aria-label="Import library JSON" />
            <Button variant="ghost" onClick={() => importInput.current?.click()}>Import JSON</Button>
          </>
        }
      />
      <Alert tone="info" className="mb-4">
        Your library is stored only in this browser (IndexedDB). It is <strong>not synchronized</strong> across devices or browsers — export JSON regularly as a backup.
      </Alert>

      {loading && <Spinner label="Loading library…" />}
      {error && <Alert tone="error" title="Could not load your library">{error}</Alert>}

      {!loading && !error && entries.length === 0 && (
        <EmptyState title="Your library is empty" action={<Link className="text-sm font-medium text-brand-700 hover:underline dark:text-brand-300" href="/discover">Discover papers →</Link>}>
          Save papers from Discover, or upload a PDF in the Reader and save it to your library.
        </EmptyState>
      )}

      {entries.length > 0 && (
        <>
          <Card className="mb-4">
            <div className="grid gap-3 md:grid-cols-4">
              <div className="md:col-span-1">
                <label htmlFor="lib-search" className={labelClass}>Search</label>
                <input id="lib-search" className={inputClass} value={text} onChange={(e) => setText(e.target.value)} placeholder="Title, author, notes…" />
              </div>
              <div>
                <label htmlFor="lib-tag" className={labelClass}>Tag</label>
                <select id="lib-tag" className={inputClass} value={tag} onChange={(e) => setTag(e.target.value)}>
                  <option value="">All tags</option>
                  {allTags.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="lib-year" className={labelClass}>Year</label>
                <select id="lib-year" className={inputClass} value={year} onChange={(e) => setYear(e.target.value)}>
                  <option value="">All years</option>
                  {allYears.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="lib-status" className={labelClass}>Status</label>
                <select id="lib-status" className={inputClass} value={status} onChange={(e) => setStatus(e.target.value as ReadingStatus | "")}>
                  <option value="">All</option>
                  {(Object.keys(STATUS_LABEL) as ReadingStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                </select>
              </div>
            </div>
          </Card>
          <p className="mb-3 text-sm text-stone-600 dark:text-stone-300" aria-live="polite">
            Showing {visible.length} of {entries.length} papers
          </p>
          {visible.length === 0 && <EmptyState title="No papers match these filters" />}
          <ul className="space-y-3">
            {visible.map((entry) => (
              <li key={entry.paper.id}>
                <LibraryItem entry={entry} />
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

function LibraryItem({ entry }: { entry: LibraryEntry }) {
  const notify = useToast();
  const [notes, setNotes] = useState(entry.notes);
  const [tagInput, setTagInput] = useState(entry.tags.join(", "));
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const p = entry.paper;
  const idBase = p.id.replace(/[^a-zA-Z0-9]/g, "-");

  const save = async () => {
    setSaving(true);
    try {
      await updateEntry(p.id, { notes, tags: tagInput.split(",") });
      notify("Notes and tags saved.");
      setEditing(false);
    } catch (e) {
      notify(errorMessage(e), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-stone-900 dark:text-white">{p.title}</h2>
          <p className="mt-0.5 text-sm text-stone-600 dark:text-stone-300">
            {formatAuthors(p.authors)}{p.venue ? ` · ${p.venue}` : ""}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Badge tone={STATUS_TONE[entry.status]}>{STATUS_LABEL[entry.status]}</Badge>
            {entry.documentId && <Badge tone="violet">PDF attached</Badge>}
            <PaperBadges paper={p} />
            {entry.tags.map((t) => <Badge key={t} tone="blue">#{t}</Badge>)}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor={`status-${idBase}`} className="sr-only">Reading status</label>
          <select
            id={`status-${idBase}`}
            className="rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-sm dark:border-stone-600 dark:bg-stone-800"
            value={entry.status}
            onChange={async (e) => {
              try {
                await updateEntry(p.id, { status: e.target.value as ReadingStatus });
              } catch (err) {
                notify(errorMessage(err), "error");
              }
            }}
          >
            {(Object.keys(STATUS_LABEL) as ReadingStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
          <Link href={`/reader?paper=${encodeURIComponent(p.id)}`} className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700">
            {entry.documentId ? "Read" : "Open / attach PDF"}
          </Link>
          <Link href={`/study?paper=${encodeURIComponent(p.id)}`} className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-medium hover:bg-stone-50 dark:border-stone-600 dark:hover:bg-stone-800">
            Study
          </Link>
          <Button size="sm" variant="ghost" onClick={() => setEditing((v) => !v)} aria-expanded={editing}>
            {editing ? "Close notes" : "Notes & tags"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-red-700 dark:text-red-300"
            onClick={async () => {
              if (!window.confirm(`Remove "${p.title}" from your library?`)) return;
              await removePaper(p.id);
              notify("Removed from library.", "info");
            }}
          >
            Remove
          </Button>
        </div>
      </div>
      {!editing && entry.notes && <p className="mt-3 whitespace-pre-wrap rounded-lg bg-stone-50 p-3 text-sm dark:bg-stone-800">{entry.notes}</p>}
      {editing && (
        <div className="mt-4 space-y-3 border-t border-stone-200 pt-4 dark:border-stone-700">
          <div>
            <label htmlFor={`notes-${idBase}`} className={labelClass}>Personal notes</label>
            <textarea id={`notes-${idBase}`} className={`${inputClass} min-h-28`} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={20000} />
          </div>
          <div>
            <label htmlFor={`tags-${idBase}`} className={labelClass}>Tags (comma-separated)</label>
            <input id={`tags-${idBase}`} className={inputClass} value={tagInput} onChange={(e) => setTagInput(e.target.value)} placeholder="transformers, survey" />
          </div>
          <div className="flex items-center justify-between gap-2">
            <SourceLinks paper={p} />
            <Button onClick={save} loading={saving}>Save</Button>
          </div>
        </div>
      )}
    </Card>
  );
}
