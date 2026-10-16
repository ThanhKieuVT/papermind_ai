"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAiStatus } from "@/hooks/useAiStatus";
import { getAccessToken } from "@/lib/api/client";
import { Alert, Spinner } from "@/components/ui/primitives";

/** Returns whether AI can be used from this browser and renders the reason when it cannot. */
export function useAiAvailability(): { ready: boolean; notice: React.ReactNode } {
  const { loading, status } = useAiStatus();
  const [hasToken, setHasToken] = useState(false);
  useEffect(() => setHasToken(getAccessToken().length > 0), []);

  if (loading) return { ready: false, notice: <Spinner label="Checking AI availability…" /> };
  if (!status) return { ready: false, notice: <Alert tone="error">Could not check AI availability. Reload the page to retry.</Alert> };
  if (!status.enabled) {
    return {
      ready: false,
      notice: (
        <Alert tone="warning" title="AI features are disabled">
          {status.reason} Non-AI features (search, reading, library, rule-based study cards) still work.
        </Alert>
      ),
    };
  }
  if (status.requiresToken && !hasToken) {
    return {
      ready: false,
      notice: (
        <Alert tone="info" title="Access token required">
          This deployment requires an AI access token. Enter it in{" "}
          <Link href="/settings" className="font-medium underline">Settings</Link>.
        </Alert>
      ),
    };
  }
  return { ready: true, notice: null };
}
