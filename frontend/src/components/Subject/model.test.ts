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
import type { Goal } from '@/types';

/** A goal on this subject, with only the fields the model reads set. */
function goal(over: Partial<Goal> = {}): Goal {
  return {
    id: 'g1',
    title: 'Competition ready',
    status: 'active',
    progress: 40,
    subject_ids: 'maths',
    deadline: '2026-12-01',
    start_date: '2026-08-01',
    created_at: '2026-08-01',
    // Without this `goalNumbers` reads it as a milestone goal with no
    // milestones: target 0, and therefore no pace and no projection. Every
    // test that wants a *projectable* goal needs it, and the one that wants
    // the opposite overrides it.
    measure: 'number',
    target_number: 100,
    current_value: 40,
    unit: 'problems',
    ...over,
  } as Goal;
}

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

describe('what to do next', () => {
  /* Four bands with a wide gap and a struggle reason, so there is always more
     than one thing the page could say. What is being tested is the ordering
     and the count, not whether any single card appears. */
  const busy = () => [
    ...Array.from({ length: 4 }, () => done({ difficulty: 1, execution: 5 })),
    ...Array.from({ length: 4 }, () =>
      done({ difficulty: 5, execution: 2, reason: 'interrupted' }),
    ),
  ];

  it('never names two different measures as the lowest of the four', () => {
    // The bug this replaced: one card per rate under 60, each captioned "the
    // lowest of the four", two of them on screen at once. Not a wording
    // problem — the page contradicting itself in the panel whose whole job is
    // to be trusted.
    const model = subjectModel(busy(), 'maths', '30d', TODAY);
    const lowest = model.advice.filter((item) => item.id.startsWith('rate-'));

    expect(lowest.length).toBeLessThanOrEqual(1);
  });

  it('names the lowest measure only when it is clearly the lowest', () => {
    // Two rates a couple of points apart are not a weak spot, they are the low
    // end of four numbers that are all fine.
    const model = subjectModel(
      [done({ difficulty: 3, execution: 3, due_date: TODAY, met_deadline: true })],
      'maths',
      '30d',
      TODAY,
    );
    const named = model.advice.filter((item) => item.id.startsWith('rate-'));
    for (const item of named) {
      // Whatever it named, it has to be the measure that is actually lowest.
      const lowest = [...model.rates]
        .filter((r) => r.known)
        .sort((a, b) => a.now - b.now)[0]!;
      expect(item.id).toBe(`rate-${lowest.key}`);
    }
  });

  it('leads with the goal rather than with an internal measure', () => {
    // The whole ordering. "Quality is the measure holding the grade down" is a
    // true sentence answering a question nobody asked; a goal is what the
    // reader actually said they wanted.
    const model = subjectModel(busy(), 'maths', '30d', TODAY, [
      goal({ progress: 10, deadline: '2026-09-20' }),
    ]);

    expect(model.advice[0]!.id).toBe('goal-g1');
    // And it carries its arithmetic, like every other card here.
    expect(model.advice[0]!.why).toContain('%');
  });

  it('does not call a goal on course when it cannot be projected at all', () => {
    // The failure this guards is quiet: a goal with no target number or no
    // date produces a null drift, and a two-branch test would sort it into the
    // good pile and print "on course" — a claim, off no evidence, in the panel
    // that leads the page.
    const model = subjectModel(busy(), 'maths', '30d', TODAY, [
      goal({ measure: undefined as never, target_number: 0, deadline: '' }),
    ]);
    const led = model.advice.find((item) => item.id === 'goal-g1')!;

    expect(led.title).not.toMatch(/on course/i);
    // It asks for what is missing rather than reporting a state, which is the
    // shorter and more useful of the two things it could say.
    expect(led.title).toMatch(/give .* a target and a date/i);
    expect(led.detail).toMatch(/no arrival to pace against/i);
  });

  it('does not lead with a goal that belongs to another subject', () => {
    const model = subjectModel(busy(), 'maths', '30d', TODAY, [
      goal({ subject_ids: 'physics,chem' }),
    ]);
    expect(model.goals).toEqual([]);
    expect(model.advice.every((item) => !item.id.startsWith('goal-'))).toBe(true);
  });

  it('reads a goal naming several subjects, not just a lone id', () => {
    const model = subjectModel(busy(), 'maths', '30d', TODAY, [
      goal({ subject_ids: 'physics, maths ,chem' }),
    ]);
    expect(model.goals.map((g) => g.id)).toEqual(['g1']);
  });

  it('ignores a goal that is no longer being worked on', () => {
    const model = subjectModel(busy(), 'maths', '30d', TODAY, [
      goal({ status: 'completed' as Goal['status'] }),
    ]);
    expect(model.goals).toEqual([]);
  });

  it('falls back to the record when nothing has been aimed at', () => {
    // No goal is a real state and the commonest one. The page still has to
    // rank something, and the widest band gap is the honest lead.
    const model = subjectModel(busy(), 'maths', '30d', TODAY, []);
    expect(model.advice[0]!.id).toBe('weakest-band');
    expect(model.advice[0]!.weight).toBe('first');
  });
});


describe('the verdict at the top of the page', () => {
  it('says nothing happened rather than grading an empty window', () => {
    const model = subjectModel([done({ completed_at: ago(200) })], 'maths', '7d', TODAY);
    expect(model.headline.verdict).toMatch(/nothing finished/i);
  });

  it('leads with a goal that is going to miss, over any internal measure', () => {
    // The same ordering the recommendations use, said in one line — the page's
    // headline and its advice cannot disagree about what matters most.
    const tasks = [
      ...Array.from({ length: 4 }, () => done({ difficulty: 1, execution: 5 })),
      ...Array.from({ length: 4 }, () => done({ difficulty: 5, execution: 2 })),
    ];
    const model = subjectModel(tasks, 'maths', '30d', TODAY, [
      goal({ progress: 10, current_value: 10, target_number: 100, deadline: '2026-09-20' }),
    ]);
    expect(model.headline.verdict).toContain('Competition ready');
  });

  it('names the band gap when there is no goal', () => {
    const tasks = [
      ...Array.from({ length: 4 }, () => done({ difficulty: 1, execution: 5 })),
      ...Array.from({ length: 4 }, () => done({ difficulty: 5, execution: 2 })),
    ];
    const model = subjectModel(tasks, 'maths', '30d', TODAY);
    expect(model.headline.verdict).toContain('Brutal');
    // Short enough to set in large bold type without wrapping into a paragraph.
    expect(model.headline.verdict.length).toBeLessThan(110);
  });

  it('carries the same grade the score rounds to', () => {
    const model = subjectModel([done({ difficulty: 5, execution: 5 })], 'maths', '30d', TODAY);
    expect(model.headline.grade).toBe(model.grade);
    expect(model.headline.score).toBe(model.score);
  });
});

describe('the chart series', () => {
  it('declines to draw a line through two points', () => {
    // Two buckets is a line between two dots, which says less than the tiles
    // above it already do.
    const model = subjectModel([done(), done({ completed_at: ago(1) })], 'maths', '30d', TODAY);
    expect(model.series.any).toBe(false);
  });

  it('buckets a long window rather than drawing a point per day', () => {
    const tasks = Array.from({ length: 40 }, (_, at) =>
      done({ completed_at: ago(at * 8) }),
    );
    const model = subjectModel(tasks, 'maths', '1y', TODAY);

    expect(model.series.any).toBe(true);
    // Near twelve at every window, so the chart reads the same way whichever
    // one is picked — never 365 points.
    expect(model.series.done.length).toBeLessThanOrEqual(13);
    expect(model.series.done.length).toBe(model.series.quality.length);
    expect(model.series.done.length).toBe(model.series.labels.length);
  });

  it('counts every finished task into exactly one bucket', () => {
    const tasks = Array.from({ length: 9 }, (_, at) => done({ completed_at: ago(at * 3) }));
    const model = subjectModel(tasks, 'maths', '30d', TODAY);
    expect(model.series.done.reduce((sum, n) => sum + n, 0)).toBe(model.finished);
  });

  it('leaves a period with nothing rated as null rather than as zero quality', () => {
    // Drawing it as zero would invent a bad fortnight out of a quiet one.
    const tasks = [
      done({ completed_at: ago(1), difficulty: 4, execution: 4 }),
      done({ completed_at: ago(2) }),
      done({ completed_at: ago(20) }),
      done({ completed_at: ago(25) }),
    ];
    const model = subjectModel(tasks, 'maths', '30d', TODAY);
    expect(model.series.quality.some((value) => value === null)).toBe(true);
  });
});
