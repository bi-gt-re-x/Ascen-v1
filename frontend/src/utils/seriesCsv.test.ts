/**
 * The audit export.
 *
 * The report is prose and its tests would be tests of wording; this is a file
 * somebody opens in a spreadsheet and does arithmetic in, so what matters is
 * that the arithmetic comes out the same as the page's. These check the three
 * ways a CSV silently lies: a row that does not line up with its header, a
 * value that was rounded on the way out, and a cell that split.
 */
import { describe, expect, it } from 'vitest';
import { buildSeriesCsv, seriesFilename } from './seriesCsv';
import { days } from '@/test/factories';
import type { GrowthDay } from '@/types';

const rows = (csv: string) => csv.split('\r\n');

describe('buildSeriesCsv', () => {
  it('writes a header and one row per day, oldest first', () => {
    const csv = buildSeriesCsv(days('2026-09-01', 3, { xp_earned: 40 }))!;
    const lines = rows(csv);
    expect(lines).toHaveLength(4);
    expect(lines[0]).toBe(
      'date,xp_earned,tasks_completed,focus_minutes,rated_tasks,quality_score,' +
        'avg_difficulty,avg_execution,cumulative_xp,cumulative_focus_minutes',
    );
    expect(lines[1]).toMatch(/^2026-09-01,40,/);
    expect(lines[3]).toMatch(/^2026-09-03,40,/);
  });

  it('keeps every column lined up with its header', () => {
    const csv = buildSeriesCsv(days('2026-09-01', 2, { xp_earned: 10 }))!;
    const lines = rows(csv);
    const width = lines[0]!.split(',').length;
    lines.slice(1).forEach((line) => expect(line.split(',')).toHaveLength(width));
  });

  it('does not round on the way out', () => {
    // The page rounds for display. A file meant for checking the page must not,
    // or the reader reconciles two rounded numbers and finds a difference that
    // is the export's and not the account's.
    const csv = buildSeriesCsv(
      days('2026-09-01', 1, { quality_score: 12.457, avg_execution: 3.6666 }),
    )!;
    expect(csv).toContain('12.457');
    expect(csv).toContain('3.6666');
  });

  it('carries rated_tasks, which is what tells a zero apart from a silence', () => {
    const csv = buildSeriesCsv(
      days('2026-09-01', 1, { quality_score: 0, rated_tasks: 0 } as Partial<GrowthDay>),
    )!;
    expect(rows(csv)[0]).toContain('rated_tasks');
  });

  it('quotes a value that would otherwise split its row', () => {
    /* Nothing written today needs this. A column added later that carries a
       name would, and the failure is a file that still opens and is wrong. */
    const csv = buildSeriesCsv([
      { ...days('2026-09-01', 1)[0]!, date: 'a,b' } as GrowthDay,
    ])!;
    expect(rows(csv)[1]!.startsWith('"a,b",')).toBe(true);
  });

  it('uses CRLF, which is what stops Excel reading the file as one row', () => {
    const csv = buildSeriesCsv(days('2026-09-01', 2))!;
    expect(csv).toContain('\r\n');
    expect(csv.split('\n').every((line, i, all) => i === all.length - 1 || line.endsWith('\r'))).toBe(
      true,
    );
  });

  it('is null rather than a lone header when there is nothing to write', () => {
    expect(buildSeriesCsv([])).toBeNull();
  });

  it('names the file by account and day', () => {
    expect(seriesFilename('myles', new Date('2026-09-05T10:00:00Z'))).toBe(
      'ascen-data-myles-2026-09-05.csv',
    );
  });
});
