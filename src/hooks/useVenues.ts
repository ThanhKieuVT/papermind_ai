"use client";

import { useEffect, useState } from "react";
import type { VenueDataset } from "@/lib/venues/types";
import { FOLLOW_EVENT, readFollows } from "@/lib/venues/follow";

let cache: Promise<VenueDataset> | null = null;

function loadVenues(): Promise<VenueDataset> {
  cache ??= fetch("/data/venues.json")
    .then((r) => {
      if (!r.ok) throw new Error(`Could not load venue data (HTTP ${r.status}).`);
      return r.json() as Promise<VenueDataset>;
    })
    .catch((e: unknown) => {
      cache = null;
      throw e instanceof Error ? e : new Error("Could not load venue data.");
    });
  return cache;
}

export type VenuesState = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; data: VenueDataset };

export function useVenues(): VenuesState {
  const [state, setState] = useState<VenuesState>({ status: "loading" });
  useEffect(() => {
    let active = true;
    loadVenues()
      .then((data) => active && setState({ status: "ready", data }))
      .catch((e: Error) => active && setState({ status: "error", message: e.message }));
    return () => {
      active = false;
    };
  }, []);
  return state;
}

export function useFollows(): Set<string> {
  const [follows, setFollows] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    const update = () => setFollows(readFollows());
    update();
    window.addEventListener(FOLLOW_EVENT, update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener(FOLLOW_EVENT, update);
      window.removeEventListener("storage", update);
    };
  }, []);
  return follows;
}

/** Current time, re-rendered every `intervalMs`. */
export function useNow(intervalMs: number): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
