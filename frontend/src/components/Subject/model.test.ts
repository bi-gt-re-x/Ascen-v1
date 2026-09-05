/**
 * The arithmetic behind the subject page.
 *
 * Every figure on that page is a claim about the reader, so the things worth
 * testing are the ones where a plausible-looking wrong answer would never be
 * noticed: a rate that scores an account for not using a feature, a comparison
 * against a period of a different length, a streak that breaks at midnight, a
 * "no change" printed where the honest answer is silence.
 *
 * The model takes `today` as an argument rather than reading the clock, which
 * is what makes all of that testable at all.
 */
import { describe, expect, it } from 'vitest';
import { subjectModel } from './model';
import type { AnalyticsTask } from '@/services/analytics';

const TODAY = '2026-09-05';

let seq = 0;

/** A finished task, with only the fields a given test cares about set. */
function done(over: Partial<AnalyticsTask> = {}): AnalyticsTask {
  seq += 1;
  return {
    id: `t${seq}`,
    title: `Task ${seq}`,
    status: 'done',
    priority: 'medium',
    subject: 'maths',
    xp_value: 30,
    created_at: '2026-09-01',
    completed_at: TODAY,
    ...over,
  } as AnalyticsTask;
}

/** Days before today, as the ISO day the model compares against. */
function ago(days: number): string {
  const at = new Date(`${TODAY}T00:00:00Z`);
  at.setUTCDate(at.getUTCDate() - days);
  return at.toISOString().slice(0, 10);
}

describe('which tasks a subject page counts', () => {
  it('counts only its own subject', () => {
    const model = subjectModel(
      [done(), done(), done({ subject: 'physics' })],
      'maths',
      '30d',
      TODAY,
    );
    expect(model.finished).toBe(2);
  });

  it('compares against a period of the same length, not everything before', () => {
    // Three inside the window, two in the equal-length run before it, and one
    // far enough back to belong to neither. A baseline that reached further
    // would report the extra days as a collapse in effort.
    const tasks = [
      done({ completed_at: ago(1) }),
      done({ completed_at: ago(5) }),
      done({ completed_at: ago(20) }),
      done({ completed_at: ago(40) }),
      done({ completed_at: ago(50) }),
      done({ completed_at: ago(200) }),
    ];
    const model = subjectModel(tasks, 'maths', '30d', TODAY);

    expect(model.finished).toBe(3);
    expect(model.finishedBefore).toBe(2);
    expect(model.growth.find((g) => g.key === 'volume')?.change).toBe(50);
  });

  it('has no previous period at all time, so states no change against one', () => {
    const model = subjectModel([done(), done({ completed_at: ago(400) })], 'maths', 'all', TODAY);
    expect(model.finished).toBe(2);
    expect(model.finishedBefore).toBe(0);
    // Null rather than -100 or 0: there is nothing behind All Time to compare
    // it to, and a figure would be a claim about a period that does not exist.
    expect(model.growth.find((g) => g.key === 'volume')?.change).toBeNull();
  });
});

describe('the four rates the score is made of', () => {
  it('does not score an account for not using due dates', () => {
    // Timeliness counts only tasks that *had* a deadline. Counting the rest as
    // missed would make the letter grade a report on which features are used.
    const model = subjectModel([done(), done()], 'maths', '30d', TODAY);
    const timeliness = model.rates.find((r) => r.key === 'timeliness')!;

    expect(timeliness.known).toBe(false);
    // And an unmeasurable rate is left out of the mean rather than counted as
    // zero, which would drag every grade down to the features in use.
    expect(model.score).not.toBeNull();
    expect(model.score).toBeGreaterThan(0);
  });

  it('scores timeliness off the dated tasks alone', () => {
    const model = subjectModel(
      [
        done({ due_date: TODAY, met_deadline: true }),
        done({ due_date: TODAY, met_deadline: true }),
        done({ due_date: TODAY, met_deadline: false }),
        done(),
      ],
      'maths',
      '30d',
      TODAY,
    );
    expect(Math.round(model.rates.find((r) => r.key === 'timeliness')!.now)).toBe(67);
  });

  it('reads quality as difficulty times execution out of 25', () => {
    const model = subjectModel(
      [done({ difficulty: 4, execution: 5 }), done({ difficulty: 2, execution: 3 })],
      'maths',
      '30d',
      TODAY,
    );
    // (20 + 6) / 2 = 13 out of 25 = 52%.
    expect(Math.round(model.rates.find((r) => r.key === 'quality')!.now)).toBe(52);
  });

  it('ignores a task rated on only one row', () => {
    // Half a rating is a real answer to the row it was given for, but it is
    // not a quality score — standing an average in for the missing half would
    // invent the exact opinion the prompt exists to collect.
    const model = subjectModel(
      [done({ difficulty: 4, execution: 5 }), done({ difficulty: 4 })],
      'maths',
      '30d',
      TODAY,
    );
    expect(Math.round(model.rates.find((r) => r.key === 'quality')!.now)).toBe(80);
  });

  it('prints the numbers the letter was made of', () => {
    // The grade is only worth anything if it can be checked, so the page has
    // to be able to show its working.
    const model = subjectModel([done({ difficulty: 5, execution: 5 })], 'maths', '30d', TODAY);
    expect(model.howScored).toContain('Quality 100');
    expect(model.howScored).toContain(`${model.score} out of 100`);
    expect(model.grade).not.toBeNull();
  });

  it('has no score at all when nothing has been finished in the window', () => {
    const model = subjectModel([done({ completed_at: ago(90) })], 'maths', '7d', TODAY);
    expect(model.any).toBe(true);
    expect(model.finished).toBe(0);
  });
});

describe('the streak', () => {
  it('counts back from today', () => {
    const model = subjectModel(
      [done({ completed_at: ago(0) }), done({ completed_at: ago(1) }), done({ completed_at: ago(2) })],
      'maths',
      '30d',
      TODAY,
    );
    expect(model.streak).toBe(3);
  });

  it('survives a day that has not been worked yet', () => {
    // Counted from yesterday when today is still empty. A streak that broke
    // the moment the clock passed midnight would report every reader as having
    // lost it every morning.
    const model = subjectModel(
      [done({ completed_at: ago(1) }), done({ completed_at: ago(2) })],
      'maths',
      '30d',
      TODAY,
    );
    expect(model.streak).toBe(2);
  });

  it('stops at the gap rather than counting every active day', () => {
    const model = subjectModel(
      [done({ completed_at: ago(1) }), done({ completed_at: ago(4) }), done({ completed_at: ago(5) })],
      'maths',
      '30d',
      TODAY,
    );
    expect(model.streak).toBe(1);
  });
});

describe('the difficulty bands, which stand in for sub-skills', () => {
  it('ranks only bands with enough behind them to be a finding', () => {
    // Two tasks is a bad afternoon, not a weakness. Naming it would put a
    // recommendation in front of the reader off a sample of two.
    const tasks = [
      ...Array.from({ length: 4 }, () => done({ difficulty: 2, execution: 5 })),
      done({ difficulty: 5, execution: 1 }),
      done({ difficulty: 5, execution: 1 }),
    ];
    const model = subjectModel(tasks, 'maths', '30d', TODAY);

    expect(model.strongest?.level).toBe(2);
    // The 5-star band is drawn in the table but is not ranked as the weakest.
    expect(model.weakest?.level).toBe(2);
    expect(model.bands.find((b) => b.level === 5)?.done).toBe(2);
  });

  it('reads how a band went off the execution star', () => {
    const tasks = Array.from({ length: 3 }, () => done({ difficulty: 3, execution: 4 }));
    const model = subjectModel(tasks, 'maths', '30d', TODAY);
    // 4 of 5 = 80%.
    expect(Math.round(model.bands.find((b) => b.level === 3)!.holding!)).toBe(80);
  });

  it('names the gap only when there is a real one', () => {
    // Two bands a couple of points apart is not an insight, and a "key
    // insight" written whether or not there is one teaches the reader to skip
    // the box it lives in.
    const flat = subjectModel(
      [
        ...Array.from({ length: 3 }, () => done({ difficulty: 2, execution: 4 })),
        ...Array.from({ length: 3 }, () => done({ difficulty: 4, execution: 4 })),
      ],
      'maths',
      '30d',
      TODAY,
    );
    expect(flat.insight).toBeNull();

    const wide = subjectModel(
      [
        ...Array.from({ length: 3 }, () => done({ difficulty: 2, execution: 5 })),
        ...Array.from({ length: 3 }, () => done({ difficulty: 4, execution: 2 })),
      ],
      'maths',
      '30d',
      TODAY,
    );
    // Lowercased mid-sentence, and it names both ends: the point of the
    // line is the gap, so a sentence with only the weak half in it would
    // read as a verdict on the subject rather than on one end of it.
    expect(wide.insight).toContain('hard end');
    expect(wide.insight).toContain('easy work');
  });
});

describe('the counted reasons, which stand in for a mistake taxonomy', () => {
  it('splits the two sides and ranks each by share', () => {
    const tasks = [
      done({ difficulty: 3, execution: 1, reason: 'distracted' }),
      done({ difficulty: 3, execution: 1, reason: 'distracted' }),
      done({ difficulty: 3, execution: 2, reason: 'no-time' }),
      done({ difficulty: 3, execution: 5, reason: 'prepared' }),
    ];
    const model = subjectModel(tasks, 'maths', '30d', TODAY);

    expect(model.struggles.map((d) => d.key)).toEqual(['distracted', 'no-time']);
    expect(model.struggles[0]!.share).toBe(67);
    expect(model.wentWell.map((d) => d.key)).toEqual(['prepared']);
  });

  it('drops a word this build does not know rather than counting it', () => {
    const model = subjectModel(
      [done({ execution: 1, reason: 'ate-a-sandwich' })],
      'maths',
      '30d',
      TODAY,
    );
    expect(model.struggles).toEqual([]);
  });

  it('turns the commonest struggle into advice with its count attached', () => {
    const tasks = Array.from({ length: 3 }, () =>
      done({ difficulty: 3, execution: 1, reason: 'interrupted' }),
    );
    const model = subjectModel(tasks, 'maths', '30d', TODAY);
    const found = model.advice.find((a) => a.id === 'reason-interrupted');

    expect(found).toBeDefined();
    // The number, not just the instruction. An instruction without one is a
    // horoscope.
    expect(found!.why).toContain('3');
  });
});

describe('the run of recent readings', () => {
  it('reads oldest first, so the row is walked the way it is described', () => {
    const model = subjectModel(
      [
        done({ completed_at: ago(3), difficulty: 1, execution: 1 }),
        done({ completed_at: ago(1), difficulty: 5, execution: 5 }),
      ],
      'maths',
      '30d',
      TODAY,
    );
    expect(model.run.readings.map((r) => r.percent)).toEqual([4, 100]);
  });

  it('states no trend off a run too short to have one', () => {
    const model = subjectModel(
      [done({ difficulty: 3, execution: 3 }), done({ difficulty: 3, execution: 3 })],
      'maths',
      '30d',
      TODAY,
    );
    expect(model.run.trend).toBeNull();
  });

  it('compares the halves of a long enough run', () => {
    const model = subjectModel(
      [
        done({ completed_at: ago(6), difficulty: 2, execution: 2 }),
        done({ completed_at: ago(5), difficulty: 2, execution: 2 }),
        done({ completed_at: ago(2), difficulty: 5, execution: 5 }),
        done({ completed_at: ago(1), difficulty: 5, execution: 5 }),
      ],
      'maths',
      '30d',
      TODAY,
    );
    // 16% to 100%: an improvement of 84 points.
    expect(model.run.trend).toBe(84);
  });
});

describe('recent work', () => {
  it('lists the newest first, whatever order the tasks arrived in', () => {
    const model = subjectModel(
      [
        done({ completed_at: ago(5), title: 'older' }),
        done({ completed_at: ago(1), title: 'newer' }),
      ],
      'maths',
      '30d',
      TODAY,
    );
    expect(model.recent.map((r) => r.title)).toEqual(['newer', 'older']);
  });

  it('says a task was not rated rather than calling it a struggle', () => {
    const model = subjectModel([done()], 'maths', '30d', TODAY);
    expect(model.recent[0]!.verdict).toBe('not rated');
    expect(model.recent[0]!.quality).toBeNull();
  });
});
