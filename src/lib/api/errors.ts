export type ApiErrorCode =
  | "invalid_input"
  | "not_found"
  | "rate_limited"
  | "upstream_error"
  | "network_error"
  | "ai_disabled"
  | "unauthorized"
  | "payload_too_large"
  | "bad_ai_response";

const STATUS: Record<ApiErrorCode, number> = {
  invalid_input: 400,
  not_found: 404,
  rate_limited: 429,
  upstream_error: 502,
  network_error: 503,
  ai_disabled: 503,
  unauthorized: 401,
  payload_too_large: 413,
  bad_ai_response: 502,
};

/** An error whose message is safe to show to end users. */
export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;

  constructor(code: ApiErrorCode, message: string) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = STATUS[code];
  }
}

export interface ApiErrorBody {
  error: { code: ApiErrorCode; message: string };
}

export function toErrorBody(error: unknown): { body: ApiErrorBody; status: number } {
  if (error instanceof ApiError) {
    return { body: { error: { code: error.code, message: error.message } }, status: error.status };
  }
  // Never leak internal error details to clients.
  return {
    body: { error: { code: "upstream_error", message: "An unexpected error occurred. Please try again." } },
    status: 500,
  };
}

export function isApiErrorBody(value: unknown): value is ApiErrorBody {
  if (typeof value !== "object" || value === null || !("error" in value)) return false;
  const err = (value as { error: unknown }).error;
  return typeof err === "object" && err !== null && "message" in err && "code" in err;
}
