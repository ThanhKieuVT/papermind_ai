"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useAiStatus } from "@/hooks/useAiStatus";
import { setAccessToken, setUserGeminiKey } from "@/lib/api/client";
import { useAiCredentials } from "@/components/ai/AiStatusNotice";
import { STORES, dbClear } from "@/lib/storage/db";
import { LIBRARY_CHANGED_EVENT, listLibrary } from "@/lib/storage/library";
import { downloadText, libraryToJson } from "@/lib/export/markdown";
import { Alert, Badge, Button, Card, PageHeader, Spinner, inputClass, labelClass } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/Toast";
import { ThemeToggle } from "@/components/layout/ThemeToggle";

export function SettingsView() {
  const notify = useToast();
  const ai = useAiStatus();
  const { token, userKey } = useAiCredentials();
  const [usage, setUsage] = useState<string | null>(null);

  useEffect(() => {
    navigator.storage
      ?.estimate?.()
      .then((e) => setUsage(`${((e.usage ?? 0) / 1024 / 1024).toFixed(1)} MB used of ~${((e.quota ?? 0) / 1024 / 1024 / 1024).toFixed(1)} GB available`))
      .catch(() => setUsage(null));
  }, []);

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
          <h2 className="mb-3 font-semibold">AI assistant</h2>
          {ai.loading ? (
            <Spinner label="Checking…" />
          ) : !ai.status ? (
            <Alert tone="error">Could not reach the server.</Alert>
          ) : ai.status.userKeyAllowed && userKey ? (
            <p className="text-sm"><Badge tone="green">Enabled</Badge> using <strong>your own Gemini key</strong></p>
          ) : ai.status.enabled && (!ai.status.requiresToken || token) ? (
            <p className="text-sm"><Badge tone="green">Enabled</Badge> Model: <code>{ai.status.model}</code></p>
          ) : ai.status.enabled || ai.status.userKeyAllowed ? (
            <p className="text-sm"><Badge tone="amber">Locked</Badge> Enter an access code or your own Gemini key below.</p>
          ) : (
            <Alert tone="warning" title="Disabled">{ai.status.reason}</Alert>
          )}

          {ai.status?.enabled && ai.status.requiresToken && (
            <CredentialForm
              id="access-code"
              label="Access code (from the site owner)"
              saved={token}
              onSave={(v) => {
                setAccessToken(v);
                notify(v ? "Access code saved in this browser." : "Access code removed.");
              }}
            />
          )}
          {ai.status?.userKeyAllowed && (
            <CredentialForm
              id="user-key"
              label="Your own Gemini API key"
              help={
                <>
                  Free from{" "}
                  <a className="font-medium text-brand-700 underline dark:text-brand-300" href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer">
                    Google AI Studio
                  </a>
                  . Stored only in this browser and sent only with your AI requests; it is used instead of the site&apos;s key.
                </>
              }
              saved={userKey}
              onSave={(v) => {
                if (v && !/^[A-Za-z0-9_-]{30,80}$/.test(v)) {
                  notify("That doesn't look like a Gemini API key.", "error");
                  return;
                }
                setUserGeminiKey(v);
                notify(v ? "Your Gemini key was saved in this browser." : "Your Gemini key was removed.");
              }}
            />
          )}
          <p className="mt-3 text-xs text-stone-500">The site&apos;s own API key is configured on the server only and is never sent to the browser.</p>
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

function CredentialForm({ id, label, help, saved, onSave }: { id: string; label: string; help?: ReactNode; saved: string; onSave: (value: string) => void }) {
  const [value, setValue] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSave(value.trim());
    setValue("");
  };
  return (
    <form onSubmit={submit} className="mt-4 space-y-2 border-t border-stone-100 pt-4 dark:border-stone-800">
      <label htmlFor={id} className={labelClass}>{label}</label>
      {saved ? (
        <div className="flex items-center justify-between gap-2 rounded-lg bg-stone-50 px-3 py-2 text-sm dark:bg-stone-800">
          <span>Saved: <code>••••{saved.slice(-4)}</code></span>
          <Button size="sm" variant="ghost" onClick={() => onSave("")}>Remove</Button>
        </div>
      ) : (
        <div className="flex gap-2">
          <input id={id} type="password" autoComplete="off" className={inputClass} value={value} onChange={(e) => setValue(e.target.value)} />
          <Button type="submit" size="sm">Save</Button>
        </div>
      )}
      {help && <p className="text-xs text-stone-500">{help}</p>}
    </form>
  );
}
