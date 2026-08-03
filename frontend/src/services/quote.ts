/**
 * The dashboard's daily quote.
 *
 * One call, and it goes to *our* backend rather than to the quote provider.
 * The old frontend called api-ninjas.com straight from the browser with the
 * key written into api.js, which shipped a live credential in the
 * page source. backend/api/quote.py holds the key now, picks a source and
 * caches the day's answer; see the note at the top of that file.
 *
 * The endpoint always succeeds — it falls back to a built-in line when every
 * upstream is unreachable — so a caller does not need a story for "no quote
 * today". It still returns the standard envelope, because every endpoint does.
 */
import { get } from './api';
import type { ApiResult } from '@/types';

export interface DailyQuote {
  quote: string;
  author: string;
  /** 'api-ninjas' | 'zenquotes' | 'built-in' — which source answered. */
  source: string;
}

export function daily(): Promise<ApiResult<DailyQuote>> {
  return get<DailyQuote>('/api/daily_quote');
}
