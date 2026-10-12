const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  code: string;
  status: number;
  details?: unknown;

  constructor(code: string, message: string, status: number, details?: unknown) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

let csrfToken: string | null = null;

async function ensureCsrfToken(): Promise<string> {
  if (csrfToken) return csrfToken;
  const res = await fetch(`${API_BASE_URL}/auth/csrf-token`, { credentials: "include" });
  const data = await res.json();
  csrfToken = data.csrfToken;
  return csrfToken!;
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
}

/** The CSRF token is tied to the browser's session cookie, so it must be re-fetched whenever the session changes. */
export function clearCsrfToken() {
  csrfToken = null;
}

// Endpoints that start, end or replace a session. After one of these succeeds the cached token
// (fetched while logged out, or as another user) no longer matches the new session cookie.
const SESSION_CHANGING = ["/auth/login", "/auth/register", "/auth/logout", "/auth/password-reset/verify"];

/**
 * Thin fetch wrapper: sends the session cookie (credentials: 'include'),
 * attaches the CSRF token on mutating requests, and normalizes errors to
 * the shared { code, message, details } shape (error-handling-logging.md).
 *
 * CSRF safety net: a mutating request that comes back CSRF_INVALID (token
 * expired, server restarted, session changed in another tab) is retried
 * exactly once with a fresh token, so people never see that error for a
 * stale token they cannot fix themselves.
 */
export async function apiClient<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method ?? "GET";

  const send = async () => {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (method !== "GET") headers["X-CSRF-Token"] = await ensureCsrfToken();
    const res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      credentials: "include",
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    const data = res.status === 204 ? undefined : await res.json().catch(() => ({}));
    return { res, data };
  };

  let { res, data } = await send();
  if (method !== "GET" && res.status === 403 && data?.code === "CSRF_INVALID") {
    clearCsrfToken();
    ({ res, data } = await send());
  }

  if (res.ok && method !== "GET" && SESSION_CHANGING.some((p) => path.startsWith(p))) clearCsrfToken();

  if (res.status === 204) return undefined as T;

  if (!res.ok) {
    throw new ApiError(
      data?.code ?? "UNKNOWN_ERROR",
      data?.message ?? "Something went wrong.",
      res.status,
      data?.details
    );
  }

  return data as T;
}

/**
 * Multipart file upload — separate from apiClient because it must send
 * FormData (no JSON Content-Type) while still carrying the session cookie
 * and CSRF token like every other mutating request.
 */
export async function apiUpload(file: File): Promise<{ url: string; publicId: string }> {
  const send = async () => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${API_BASE_URL}/uploads`, {
      method: "POST",
      headers: { "X-CSRF-Token": await ensureCsrfToken() },
      credentials: "include",
      body: formData,
    });
    return { res, data: await res.json().catch(() => ({})) };
  };

  let { res, data } = await send();
  if (res.status === 403 && data.code === "CSRF_INVALID") {
    clearCsrfToken();
    ({ res, data } = await send());
  }
  if (!res.ok) {
    throw new ApiError(data.code ?? "UPLOAD_FAILED", data.message ?? "Upload failed.", res.status, data.details);
  }
  return data;
}
