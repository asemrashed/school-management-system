import { ApiError } from "./api-client";

/** User-facing message for any thrown value (API errors carry a safe message). */
export function errorMessage(err: unknown, fallback = "Something went wrong. Please try again."): string {
  return err instanceof ApiError ? err.message : fallback;
}
