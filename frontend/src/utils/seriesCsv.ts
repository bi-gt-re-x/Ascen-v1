/**
 * The rows the page did its arithmetic over — the other half of Export.
 *
 * `./report` writes the findings as prose, and the argument in its opening
 * comment is right: a reader who has just spent five minutes on four tabs of
 * analysis and presses Export wants the analysis, not the raw material. That
 * was used to justify deleting the CSV this replaces, and the conclusion went a
 * step too far. A page that assigns a person a score out of a hundred, a letter
 * grade and a percentile ought to keep a way of checking it — and every route
 * to the numbers behind those claims went with the file.
 *
 * So: both, for two different readers. The report is for the person who came to
 * be told something. This is for the one who wants to disagree.
 *
 * ## Why it is the window and not the whole record
 *
 * Every figure in the written report is scoped by the picker, so the file that
 * is meant to reproduce them has to be scoped the same way. A CSV of the whole
 * history beside a report about the last ninety days would not reconcile, and a
 * reader who tried would conclude the page was wrong rather than that the two
 * exports disagreed about their span.
 *
 * ## What is in it
 *
 * The stored columns, unrounded, exactly as the day series carries them —
 * nothing derived, nothing formatted. A derived column would be this file
 * having an opinion, and the point of it is to be the input to somebody else's.
 *
 * `rated_tasks` is here and matters more than it looks: `quality_score` is zero
 * both on a day of bad work and on a day nobody rated, and this is the column
 * that tells the two apart. A spreadsheet that averages the score without
 * filtering on it will get a different answer from the page, and the page will
 * be the one that is right.
 */
import type { GrowthDay } from '@/types';

/** The columns, in the order they are written. */
const COLUMNS = [
  'date',
  'xp_earned',
  'tasks_completed',
  'focus_minutes',
  'rated_tasks',
  'quality_score',
  'avg_difficulty',
  'avg_execution',
  'cumulative_xp',
  'cumulative_focus_minutes',
] as const;

/**
 * One cell, quoted only when it has to be.
 *
 * Every value written today is a number or an ISO date, so nothing here needs
 * quoting and this looks like ceremony. It is not: a column added later that
 * carries a name — a subject, a title — would silently split every row it
 * appeared in, and the file would still open, in a spreadsheet, wrong.
 */
function cell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  if (!/[",\r\n]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

/**
 * The day series as a CSV, one row per day, oldest first.
 *
 * CRLF line endings, which is what RFC 4180 asks for and what stops Excel on
 * Windows from reading the whole file as one row.
 */
export function buildSeriesCsv(days: GrowthDay[]): string | null {
  if (days.length === 0) return null;

  const rows = days.map((day) =>
    COLUMNS.map((column) => cell((day as unknown as Record<string, unknown>)[column])).join(','),
  );
  return [COLUMNS.join(','), ...rows].join('\r\n');
}

/** What the downloaded file is called. Matches `reportFilename`'s shape. */
export function seriesFilename(username: string, at: Date): string {
  return `ascen-data-${username}-${at.toISOString().slice(0, 10)}.csv`;
}
