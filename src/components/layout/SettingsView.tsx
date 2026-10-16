"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useAiStatus } from "@/hooks/useAiStatus";
import { getAccessToken, setAccessToken } from "@/lib/api/client";
import { STORES, dbClear } from "@/lib/storage/db";
import { LIBRARY_CHANGED_EVENT, listLibrary } from "@/lib/storage/library";
import { downloadText, libraryToJson } from "@/lib/export/markdown";
import { Alert, Badge, Button, Card, PageHeader, Spinner, inputClass, labelClass } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/Toast";
import { ThemeToggle } from "@/components/layout/ThemeToggle";

export function SettingsView() {
  const notify = useToast();
  const ai = useAiStatus();
  const [token, setToken] = useState("");
  const [usage, setUsage] = useState<string | null>(null);

  useEffect(() => {
    setToken(getAccessToken());
    navigator.storage
      ?.estimate?.()
      .then((e) => setUsage(`${((e.usage ?? 0) / 1024 / 1024).toFixed(1)} MB used of ~${((e.quota ?? 0) / 1024 / 1024 / 1024).toFixed(1)} GB available`))
      .catch(() => setUsage(null));
  }, []);

  const saveToken = (e: FormEvent) => {
    e.preventDefault();
    setAccessToken(token.trim());
    notify(token.trim() ? "Access token saved in this browser." : "Access token removed.");
  };

  const clearAll = async () => {
    if (!window.confirm("Delete ALL local data (library, notes, stored PDFs, study progress)? This cannot be undone.")) return;
    await Promise.all([dbClear(STORES.library), dbClear(STORES.documents), dbClear(STORES.study)]);
    window.dispatchEvent(new Event(LIBRARY_CHANGED_EVENT));
    notify("All local data deleted.", "info");
  };

  return (
    <>
      <PageHeader title="Settings" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-semibold">Appearance</h2>
          <ThemeToggle />
        </Card>
        <Card>
          <h2 className="mb-3 font-semibold">AI provider</h2>
          {ai.loading ? (
            <Spinner label="Checking…" />
          ) : ai.status?.enabled ? (
            <p className="text-sm"><Badge tone="green">Enabled</Badge> Model: <code>{ai.status.model}</code></p>
          ) : (
            <Alert tone="warning" title="Disabled">{ai.status?.reason ?? "Could not reach the server."}</Alert>
          )}
          <p className="mt-2 text-xs text-stone-500">API keys are configured on the server only (environment variables) and are never sent to the browser.</p>
          <form onSubmit={saveToken} className="mt-4 space-y-2">
            <label htmlFor="token" className={labelClass}>AI access token {ai.status?.requiresToken ? "(required on this deployment)" : "(optional)"}</label>
            <input id="token" type="password" autoComplete="off" className={inputClass} value={token} onChange={(e) => setToken(e.target.value)} />
            <Button type="submit" size="sm">Save token</Button>
          </form>
        </Card>
        <Card className="lg:col-span-2">
          <h2 className="mb-3 font-semibold">Local data</h2>
          <p className="text-sm text-stone-600 dark:text-stone-300">
            Library, notes, uploaded PDFs and study progress are stored only in this browser (IndexedDB) and are not synchronized across devices.
            {usage && <> Storage: {usage}.</>}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="secondary" onClick={async () => downloadText(`papermind-library-${new Date().toISOString().slice(0, 10)}.json`, libraryToJson(await listLibrary()), "application/json")}>
              Export library (JSON)
            </Button>
            <Button variant="danger" onClick={clearAll}>Delete all local data</Button>
          </div>
        </Card>
      </div>
    </>
  );
}
