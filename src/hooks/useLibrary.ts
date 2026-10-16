"use client";

import { useCallback, useEffect, useState } from "react";
import type { LibraryEntry } from "@/types/paper";
import { LIBRARY_CHANGED_EVENT, listLibrary } from "@/lib/storage/library";
import { errorMessage } from "@/lib/api/client";

export interface LibraryState {
  entries: LibraryEntry[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

/** Loads the IndexedDB library and refreshes whenever it changes (in this tab). */
export function useLibrary(): LibraryState {
  const [entries, setEntries] = useState<LibraryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setEntries(await listLibrary());
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
    const handler = () => void reload();
    window.addEventListener(LIBRARY_CHANGED_EVENT, handler);
    return () => window.removeEventListener(LIBRARY_CHANGED_EVENT, handler);
  }, [reload]);

  return { entries, loading, error, reload };
}
