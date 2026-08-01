/**
 * The envelope every endpoint answers in.
 *
 * The backend sends `{ success: boolean, ... }` with HTTP **200** even when it
 * failed — a failure is `{ success: false, message }`, not a 4xx. So the status
 * code says almost nothing and the flag says everything, which is why
 * `ApiResult` is a discriminated union: narrowing on `success` is the only way
 * to reach the payload, and TypeScript will not let a caller read it without
 * checking first.
 *
 * See backend/api/reply.py for the other side of this contract.
 */

/** A failed call. `message` is meant to be shown to the user. */
export interface ApiFailure {
  success: false;
  message: string;
  /** Which form field was at fault, on the endpoints that report it. */
  field?: string;
  [key: string]: unknown;
}

/** A successful call, carrying whatever that endpoint returns. */
export type ApiSuccess<T> = { success: true } & T;

/** Narrow on `.success` to get at the payload. */
export type ApiResult<T> = ApiSuccess<T> | ApiFailure;

/** Thrown when the network failed or the response was not JSON at all. */
export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status = 0) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}
