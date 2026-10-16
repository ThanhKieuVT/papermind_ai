"use client";

import { isApiErrorBody } from "@/lib/api/errors";

const TOKEN_KEY = "papermind:ai-token";
const USER_KEY_KEY = "papermind:user-gemini-key";
export const ACCESS_HEADER = "x-papermind-access";
export const USER_KEY_HEADER = "x-user-gemini-key";
/** Fired when the access code or personal key changes, so AI panels can unlock immediately. */
export const AI_CREDENTIALS_EVENT = "papermind:ai-credentials-changed";

export function getAccessToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? "";
  } catch {
    return "";
  }
}

function writeSetting(key: string, value: string): void {
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {
    // storage unavailable (private mode); value will not persist
  }
  if (typeof window !== "undefined") window.dispatchEvent(new Event(AI_CREDENTIALS_EVENT));
}

export function setAccessToken(token: string): void {
  writeSetting(TOKEN_KEY, token.trim());
}

/** The visitor's own Gemini key, stored only in this browser. */
export function getUserGeminiKey(): string {
  try {
    return localStorage.getItem(USER_KEY_KEY) ?? "";
  } catch {
    return "";
  }
}

export function setUserGeminiKey(key: string): void {
  writeSetting(USER_KEY_KEY, key.trim());
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
    const userKey = getUserGeminiKey();
    if (userKey) headers.set(USER_KEY_HEADER, userKey);
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
    if (isApiErrorBody(body)) {
      if (url.startsWith("/api/ai/")) forgetRejectedCredentials(body.error.code, body.error.message);
      throw new ClientApiError(body.error.message, body.error.code, response.status);
    }
    throw new ClientApiError(`Request failed (HTTP ${response.status}).`, "upstream_error", response.status);
  }
  return body as T;
}

/** Clears a stored access code / personal key the server rejected, so the unlock form reappears. */
function forgetRejectedCredentials(code: string, message: string): void {
  if (code === "unauthorized") setAccessToken("");
  const keyProblem = (code === "invalid_input" && /Gemini API key/i.test(message)) || (code === "ai_disabled" && /rejected/i.test(message));
  if (keyProblem && getUserGeminiKey()) setUserGeminiKey("");
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "Something went wrong.";
}
