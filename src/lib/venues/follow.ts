"use client";

const KEY = "papermind:followed-venues";
export const FOLLOW_EVENT = "papermind:follows-changed";

export function readFollows(): Set<string> {
  try {
    const raw = localStorage.getItem(KEY);
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    return new Set(Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

export function toggleFollow(id: string): Set<string> {
  const set = readFollows();
  if (set.has(id)) set.delete(id);
  else set.add(id);
  try {
    localStorage.setItem(KEY, JSON.stringify([...set]));
  } catch {
    // storage unavailable: follow state lasts for this page view only
  }
  window.dispatchEvent(new Event(FOLLOW_EVENT));
  return set;
}
