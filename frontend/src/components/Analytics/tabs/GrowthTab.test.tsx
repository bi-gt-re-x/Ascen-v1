/**
 * The Growth tab: its gate, its table, and the claim at the top of it.
 *
 * The arithmetic is pinned in utils/growthYears.test.ts — this is about what
 * the tab does with it. Three things are worth holding here:
 *
 *   * the gate counts *years*, not days, because no number of days inside one
 *     calendar year produces a second one to compare against;
 *   * a partial year is drawn and labelled rather than dropped or quietly
 *     shown as a decline;
 *   * the headline is the arc sentence and nothing else, which is the reason
 *     this tab is the only one with no `TabOpening` above it.
 */
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { GrowthTab } from './GrowthTab';
import { draw, fakeModel } from './fixtures';
import type { GrowthDay, Task } from '@/types';

const day = (date: string, over: Partial<GrowthDay> = {}): GrowthDay =>
  ({
    date, day_number: 1, xp_earned: 0, tasks_completed: 0, cumulative_xp: 0,
    avg_task_xp: 0, focus_minutes: 0, cumulative_focus_minutes: 0,
    rated_tasks: 0, quality_score: 0, avg_difficulty: 0, avg_execution: 0,
    ...over,
  }) as GrowthDay;

function year(y: number, opts: { from?: number; to?: number; tasks?: number; xp?: number } = {}) {
  const days: GrowthDay[] = [];
  for (let n = opts.from ?? 1; n <= (opts.to ?? 366); n += 1) {
    const at = new Date(Date.UTC(y, 0, n));
    if (at.getUTCFullYear() !== y) break;
    days.push(day(at.toISOString().slice(0, 10), {
      tasks_completed: opts.tasks ?? 0,
      xp_earned: opts.xp ?? 0,
    }));
  }
  return days;
}

/** Integer ratings mixed to land on the means given. */
function rated(y: number, count: number, difficulty: number, execution: number): Task[] {
  const split = (t: number) => ({ low: Math.floor(t), highs: Math.round((t - Math.floor(t)) * count) });
  const d = split(difficulty);
  const e = split(execution);
  return Array.from({ length: count }, (_, i) => ({
    id: `${y}-${i}`, title: 't', status: 'done',
    completed_at: `${y}-06-15T12:00:00`,
    difficulty: i < d.highs ? d.low + 1 : d.low,
    execution: i < e.highs ? e.low + 1 : e.low,
  }) as unknown as Task);
}

const model = (all: GrowthDay[], tasks: Task[] = []) => fakeModel({ all, tasks });

describe('the gate', () => {
  it('refuses on a single year, however much is in it', () => {
    // A whole busy year is still one row, and one row is not a comparison.
    draw(<GrowthTab model={model(year(2025, { tasks: 5, xp: 50 }), rated(2025, 400, 3, 4))} />);
    expect(screen.getByText(/needs two years to hold against each other/i)).toBeInTheDocument();
    expect(document.querySelector('.ax-gy')).toBeNull();
  });

  it('does not count a year the account sat out toward the two', () => {
    const all = [...year(2024, { tasks: 2 }), ...year(2025)];
    draw(<GrowthTab model={model(all)} />);
    expect(screen.getByText(/needs two years to hold against each other/i)).toBeInTheDocument();
  });

  it('opens once two years have work in them', () => {
    const all = [...year(2024, { tasks: 2 }), ...year(2025, { tasks: 3 })];
    draw(<GrowthTab model={model(all)} />);
    expect(screen.queryByText(/needs two years/i)).not.toBeInTheDocument();
    expect(document.querySelector('.ax-gy')).not.toBeNull();
  });
});

describe('the table', () => {
  const all = [
    ...year(2023, { from: 200, tasks: 1, xp: 10 }), // joined mid-year
    ...year(2024, { tasks: 2, xp: 20 }),
    ...year(2025, { to: 120, tasks: 3, xp: 30 }), // still running
  ];

  it('draws a row per year the account has been present for', () => {
    draw(<GrowthTab model={model(all)} />);
    const rows = document.querySelectorAll('.ax-gy tbody tr');
    expect(rows).toHaveLength(3);
    expect([...rows].map((r) => r.querySelector('th')?.textContent)).toEqual([
      '2023part year', '2024', '2025part year',
    ]);
  });

  it('marks the first and last years partial and no others', () => {
    draw(<GrowthTab model={model(all)} />);
    expect(screen.getAllByText('part year')).toHaveLength(2);
  });

  it('sets a year with nothing rated as a dash, never a zero', () => {
    // Zero would draw as "rated badly" on a year nobody answered for.
    draw(<GrowthTab model={model(all)} />);
    const row = document.querySelectorAll('.ax-gy tbody tr')[1] as HTMLElement;
    const cells = [...row.querySelectorAll('td')].map((c) => c.textContent);
    expect(cells.slice(-2)).toEqual(['—', '—']);
  });

  it('sets back a year the account was present for and did nothing in', () => {
    const quiet = [...year(2023, { tasks: 1 }), ...year(2024), ...year(2025, { tasks: 1 })];
    draw(<GrowthTab model={model(quiet)} />);
    const rows = [...document.querySelectorAll('.ax-gy tbody tr')];
    expect(rows[1]!.className).toContain('is-quiet');
    expect(rows[0]!.className).not.toContain('is-quiet');
  });
});

describe('the headline', () => {
  it('states the arc, naming both ratings', () => {
    const all = [...year(2024, { tasks: 2 }), ...year(2025, { tasks: 2 })];
    const tasks = [...rated(2024, 60, 3, 2.8), ...rated(2025, 60, 3, 3.7)];
    draw(<GrowthTab model={model(all, tasks)} />);

    const lead = document.querySelector('.ax-goal-lead') as HTMLElement;
    expect(lead).not.toBeNull();
    expect(lead.textContent).toMatch(/better at the work rather than picking easier work/);
    // Both figures, not just the flattering one.
    expect(lead.textContent).toMatch(/2\.8 to 3\.7/);
    expect(lead.textContent).toMatch(/3\.0/);
  });

  it('says plainly when a rising score came with easier work', () => {
    const all = [...year(2024, { tasks: 2 }), ...year(2025, { tasks: 2 })];
    const tasks = [...rated(2024, 60, 4.2, 2.6), ...rated(2025, 60, 3, 3.6)];
    draw(<GrowthTab model={model(all, tasks)} />);
    expect(document.querySelector('.ax-goal-lead')!.textContent)
      .toMatch(/Some of that rise is easier work/);
  });

  it('draws no headline at all when nothing is rated', () => {
    // The table still stands — volume is a fact — but the claim needs ratings
    // and the tab does not invent one.
    const all = [...year(2024, { tasks: 2 }), ...year(2025, { tasks: 2 })];
    draw(<GrowthTab model={model(all)} />);
    expect(document.querySelector('.ax-goal-lead')).toBeNull();
    expect(document.querySelector('.ax-gy')).not.toBeNull();
  });
});

describe('the standing panel', () => {
  it('keeps the percentile the Records tab was carrying', () => {
    const all = [...year(2024, { tasks: 2, xp: 20 }), ...year(2025, { tasks: 3, xp: 40 })];
    draw(<GrowthTab model={model(all)} />);
    expect(screen.getByRole('heading', { name: /Where this month sits/i })).toBeInTheDocument();
    expect(screen.getByText(/Your best 30/)).toBeInTheDocument();
  });

  it('compares a partial year on a rate, not on a total', () => {
    // The trap: a four-month year has a smaller total than the year before it
    // and that is not a decline. The tile row says so in per-working-day terms.
    const all = [...year(2024, { tasks: 3 }), ...year(2025, { to: 120, tasks: 3 })];
    draw(<GrowthTab model={model(all)} />);
    const tiles = document.querySelector('.ax-tiles') as HTMLElement;
    expect(within(tiles).getByText('Tasks a working day')).toBeInTheDocument();
    // Same rate at both ends, so the note reports no fall.
    expect(within(tiles).getByText('3.0 in 2024')).toBeInTheDocument();
  });
});
