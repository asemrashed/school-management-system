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

export function clearCsrfToken() {
  csrfToken = null;
}

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

/**
 * Thin fetch wrapper: sends the session cookie (credentials: 'include'),
 * attaches the CSRF token on mutating requests, and normalizes errors to
 * the shared { code, message, details } shape (error-handling-logging.md).
 */
export async function apiClient<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method ?? "GET";
  const headers: Record<string, string> = { "Content-Type": "application/json" };

  if (method !== "GET") {
    headers["X-CSRF-Token"] = await ensureCsrfToken();
  }

  let res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    credentials: "include",
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (res.status === 204) return undefined as T;

  let data = await res.json().catch(() => ({}));

  if (!res.ok && method !== "GET" && res.status === 403 && data.code === "CSRF_INVALID") {
    clearCsrfToken();
    headers["X-CSRF-Token"] = await ensureCsrfToken();
    res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      credentials: "include",
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    if (res.status === 204) return undefined as T;
    data = await res.json().catch(() => ({}));
  }

  if (!res.ok) {
    throw new ApiError(
      data.code ?? "UNKNOWN_ERROR",
      data.message ?? "Something went wrong.",
      res.status,
      data.details
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
  const formData = new FormData();
  formData.append("file", file);

  let res = await fetch(`${API_BASE_URL}/uploads`, {
    method: "POST",
    headers: { "X-CSRF-Token": await ensureCsrfToken() },
    credentials: "include",
    body: formData,
  });

  let data = await res.json().catch(() => ({}));
  if (!res.ok && res.status === 403 && data.code === "CSRF_INVALID") {
    clearCsrfToken();
    res = await fetch(`${API_BASE_URL}/uploads`, {
      method: "POST",
      headers: { "X-CSRF-Token": await ensureCsrfToken() },
      credentials: "include",
      body: formData,
    });
    data = await res.json().catch(() => ({}));
  }

  if (!res.ok) {
    throw new ApiError(data.code ?? "UPLOAD_FAILED", data.message ?? "Upload failed.", res.status, data.details);
  }
  return data;
}
