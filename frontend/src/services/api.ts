/**
 * The one place a network call is made.
 *
 * Everything else in services/ is built on `get`, `post`, `put` and `del`, so
 * the three rules that matter are enforced once, here, rather than remembered
 * at each of the ~50 call sites:
 *
 * 1. **`credentials: 'include'`** — the session lives in a cookie, and a fetch
 *    without this sends no cookie, so every signed-in call would come back
 *    signed out.
 *
 * 2. **`cache: 'no-store'`** — the backend is the source of truth for XP,
 *    levels and streaks. Without it a second tab can show a stale number that
 *    never corrects itself. The old scripts set this on every read for the same
 *    reason; it is not optional.
 *
 * 3. **A failure is HTTP 200.** The backend answers `{success: false}` with a
 *    200, so `response.ok` is nearly meaningless here — the flag is the answer.
 *    These helpers return the envelope rather than throwing on it, and callers
 *    narrow on `.success`. `ApiError` is thrown only when the network itself
 *    failed or the body was not JSON, which are the cases no caller can handle
 *    field-by-field anyway.
 */
import { ApiError } from '@/types';
import type { ApiResult } from '@/types';
import { API_BASE } from './constants';

type Query = Record<string, string | number | boolean | undefined | null>;

/** Build a URL, dropping params that have no value. */
function url(path: string, query?: Query): string {
  const full = `${API_BASE}${path}`;
  if (!query) return full;

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') {
      params.append(key, String(value));
    }
  }
  const qs = params.toString();
  return qs ? `${full}?${qs}` : full;
}

async function request<T>(
  path: string,
  init: RequestInit,
  query?: Query,
): Promise<ApiResult<T>> {
  let response: Response;
  try {
    response = await fetch(url(path, query), {
      credentials: 'include',
      cache: 'no-store',
      ...init,
    });
  } catch (cause) {
    throw new ApiError(
      cause instanceof Error ? cause.message : 'Network request failed',
    );
  }

  const body = await response.text();
  if (!body) {
    throw new ApiError('The server returned an empty response', response.status);
  }

  try {
    return JSON.parse(body) as ApiResult<T>;
  } catch {
    // An HTML error page, a proxy timeout, a crash — anything but the contract.
    throw new ApiError(
      `The server returned ${response.status} but not JSON`,
      response.status,
    );
  }
}

const JSON_HEADERS = { 'Content-Type': 'application/json' };

export function get<T>(path: string, query?: Query): Promise<ApiResult<T>> {
  return request<T>(path, { method: 'GET' }, query);
}

export function post<T>(path: string, body?: unknown): Promise<ApiResult<T>> {
  return request<T>(path, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(body ?? {}),
  });
}

export function put<T>(path: string, body?: unknown): Promise<ApiResult<T>> {
  return request<T>(path, {
    method: 'PUT',
    headers: JSON_HEADERS,
    body: JSON.stringify(body ?? {}),
  });
}

export function del<T>(path: string, query?: Query): Promise<ApiResult<T>> {
  return request<T>(path, { method: 'DELETE' }, query);
}

/**
 * Take the payload, or throw with the backend's own message.
 *
 * For the calls where a failure is genuinely exceptional and there is nothing
 * useful to render — an error boundary or a catch is going to handle it. Where
 * the message belongs next to a form field, narrow on `.success` instead and
 * keep the envelope.
 */
export function unwrap<T>(result: ApiResult<T>): T {
  if (!result.success) {
    throw new ApiError(result.message);
  }
  return result;
}
