"use client";

import { isApiErrorBody } from "@/lib/api/errors";

const TOKEN_KEY = "papermind:ai-token";
export const ACCESS_HEADER = "x-papermind-access";

export function getAccessToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? "";
  } catch {
    return "";
  }
}

export function setAccessToken(token: string): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // storage unavailable (private mode); token will not persist
  }
}

export class ClientApiError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = "ClientApiError";
    this.code = code;
    this.status = status;
  }
}

/** Fetches JSON from our own API routes and converts error bodies into ClientApiError. */
export async function apiFetch<T>(url: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (url.startsWith("/api/ai/")) {
    const token = getAccessToken();
    if (token) headers.set(ACCESS_HEADER, token);
  }
  let response: Response;
  try {
    response = await fetch(url, { ...init, headers });
  } catch {
    throw new ClientApiError("Network error — check your internet connection.", "network_error", 0);
  }
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    // non-JSON body
  }
  if (!response.ok) {
    if (isApiErrorBody(body)) throw new ClientApiError(body.error.message, body.error.code, response.status);
    throw new ClientApiError(`Request failed (HTTP ${response.status}).`, "upstream_error", response.status);
  }
  return body as T;
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "Something went wrong.";
}
