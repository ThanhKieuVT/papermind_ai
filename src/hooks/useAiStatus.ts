"use client";

import { useEffect, useState } from "react";
import type { AiStatus } from "@/lib/ai/guard";
import { apiFetch } from "@/lib/api/client";

export type AiStatusState = { loading: true; status: null } | { loading: false; status: AiStatus | null };

let cached: Promise<AiStatus | null> | null = null;

export function useAiStatus(): AiStatusState {
  const [state, setState] = useState<AiStatusState>({ loading: true, status: null });
  useEffect(() => {
    cached ??= apiFetch<AiStatus>("/api/ai/status").catch(() => null);
    let active = true;
    void cached.then((status) => active && setState({ loading: false, status }));
    return () => {
      active = false;
    };
  }, []);
  return state;
}
