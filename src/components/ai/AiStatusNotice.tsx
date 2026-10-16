"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useAiStatus } from "@/hooks/useAiStatus";
import {
  AI_CREDENTIALS_EVENT,
  getAccessToken,
  getUserGeminiKey,
  setAccessToken,
  setUserGeminiKey,
} from "@/lib/api/client";
import { Alert, Button, Spinner, cx, inputClass, labelClass } from "@/components/ui/primitives";
import { IconSparkles } from "@/components/ui/icons";

const GET_KEY_URL = "https://aistudio.google.com/app/apikey";

/** Current access code / personal key, kept in sync across components. */
export function useAiCredentials(): { token: string; userKey: string } {
  const [creds, setCreds] = useState({ token: "", userKey: "" });
  useEffect(() => {
    const read = () => setCreds({ token: getAccessToken(), userKey: getUserGeminiKey() });
    read();
    window.addEventListener(AI_CREDENTIALS_EVENT, read);
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener(AI_CREDENTIALS_EVENT, read);
      window.removeEventListener("storage", read);
    };
  }, []);
  return creds;
}

/**
 * Inline unlock card shown wherever AI is used: visitors can enter the owner's access code
 * or their own free Gemini key, without hunting for the Settings page.
 */
export function AiUnlock({ allowCode, allowUserKey }: { allowCode: boolean; allowUserKey: boolean }) {
  const [mode, setMode] = useState<"code" | "key">(allowCode ? "code" : "key");
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const v = value.trim();
    if (!v) return setError(mode === "code" ? "Enter the access code." : "Paste your Gemini API key.");
    if (mode === "key" && !/^[A-Za-z0-9_-]{30,80}$/.test(v)) return setError("That doesn't look like a Gemini API key (it usually starts with “AIza”).");
    if (mode === "code") setAccessToken(v);
    else setUserGeminiKey(v);
  };

  return (
    <div className="rounded-2xl border border-brand-200 bg-brand-50/60 p-5 dark:border-brand-900 dark:bg-brand-500/5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-brand-400 to-brand-700 text-white">
          <IconSparkles size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-stone-900 dark:text-white">Unlock the AI assistant</p>
          <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">
            {allowCode && allowUserKey
              ? "Use the access code from the site owner, or your own free Gemini key."
              : allowCode
                ? "Enter the access code from the site owner."
                : "Use your own free Gemini key. It takes about a minute to create."}
          </p>

          {allowCode && allowUserKey && (
            <div role="tablist" aria-label="Unlock method" className="mt-3 inline-flex rounded-lg bg-white p-1 ring-1 ring-stone-200 dark:bg-stone-900 dark:ring-stone-700">
              {(["code", "key"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="tab"
                  aria-selected={mode === m}
                  onClick={() => {
                    setMode(m);
                    setValue("");
                    setError(null);
                  }}
                  className={cx(
                    "rounded-md px-3 py-1.5 text-[13px] font-medium transition",
                    mode === m ? "bg-brand-600 text-white" : "text-stone-600 hover:text-stone-900 dark:text-stone-300",
                  )}
                >
                  {m === "code" ? "I have an access code" : "Use my own Gemini key"}
                </button>
              ))}
            </div>
          )}

          <form onSubmit={submit} className="mt-3 space-y-2">
            <label htmlFor="ai-unlock" className={labelClass}>{mode === "code" ? "Access code" : "Your Gemini API key"}</label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                id="ai-unlock"
                type="password"
                autoComplete="off"
                className={inputClass}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={mode === "code" ? "Paste the code you were given" : "AIza…"}
              />
              <Button type="submit">Unlock</Button>
            </div>
            {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
          </form>

          {mode === "key" && (
            <ol className="mt-3 list-decimal space-y-0.5 pl-5 text-xs text-stone-500 dark:text-stone-400">
              <li>
                Open{" "}
                <a href={GET_KEY_URL} target="_blank" rel="noopener noreferrer" className="font-medium text-brand-700 underline dark:text-brand-300">
                  Google AI Studio
                </a>{" "}
                and sign in with a Google account.
              </li>
              <li>Click “Create API key”, copy it and paste it above.</li>
              <li>Your key is saved only in this browser and sent only with your own AI requests. On Google&apos;s free tier, Google may use submitted text to improve its products.</li>
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}

/** Returns whether AI can be used from this browser and, if not, what to show instead. */
export function useAiAvailability(): { ready: boolean; notice: React.ReactNode } {
  const { loading, status } = useAiStatus();
  const { token, userKey } = useAiCredentials();

  if (loading) return { ready: false, notice: <Spinner label="Checking AI availability…" /> };
  if (!status) return { ready: false, notice: <Alert tone="error">Could not check AI availability. Reload the page to retry.</Alert> };

  if (status.userKeyAllowed && userKey) return { ready: true, notice: null };
  if (status.enabled && (!status.requiresToken || token)) return { ready: true, notice: null };

  const allowCode = status.enabled && status.requiresToken;
  if (allowCode || status.userKeyAllowed) {
    return { ready: false, notice: <AiUnlock allowCode={allowCode} allowUserKey={status.userKeyAllowed} /> };
  }
  return {
    ready: false,
    notice: (
      <Alert tone="warning" title="AI features are disabled">
        {status.reason} Non-AI features (search, reading, library, rule-based study cards) still work.
      </Alert>
    ),
  };
}
