/**
 * components/Subject/performance — the readings the model is asked to use.
 *
 * These are the figures that decide what the page tells somebody to do next,
 * so the tests worth having are the ones about the *conclusion* rather than
 * about the shape: that the parts of a gap sum to the gap, that a family is
 * only named leader when it is actually ahead, and that "difficulty is not
 * your problem" is only said when the reasons support it.
 */
import { describe, expect, it } from 'vitest';
import {
  calibration,
  divergence,
  errorFamilies,
  goalGap,
  performance,
} from './performance';
import type { DifficultyCurve, Dimension, Mistake, Momentum, TimeAnalysis } from './state';

function mistake(key: string, count: number): Mistake {
  return { key, label: key, count, share: 0 };
}

function dimension(key: string, value: number | null): Dimension {
  return {
    key: key as Dimension['key'],
    label: key,
    value,
    known: value !== null,
    meaning: '',
    evidence: [],
    delta: null,
  };
}

const NO_TIME: TimeAnalysis = {
  known: false, typical: null, hours: 0, drift: null,
  efficiency: null, quicker: null, rushed: 0, thorough: 0,
};

const NO_MOMENTUM: Momentum = {
  known: false, change: null, earlier: null, later: null, direction: 'unknown',
};

function curveOf(
  rungs: Array<{ level: number; label: string; done: number; execution: number | null }>,
): DifficultyCurve {
  return {
    rungs: rungs.map((rung) => ({ ...rung, quality: null, minutes: null, cleared: null })),
    any: rungs.length > 1,
    best: null,
    threshold: null,
    drop: null,
  } as DifficultyCurve;
}

// ---------------------------------------------------------------------------
describe('errorFamilies', () => {
  it('groups the six words by what they indicate rather than by frequency', () => {
    const families = errorFamilies([
      mistake('unclear', 2),
      mistake('distracted', 3),
      mistake('low-energy', 2),
      mistake('no-time', 4),
      mistake('underestimated', 1),
    ]);

    const by = Object.fromEntries(families.shares.map((row) => [row.key, row.count]));
    // The three separate words that all mean "the sitting went badly" land
    // together, which is the whole point of the regrouping.
    expect(by.execution).toBe(5);
    expect(by.conceptual).toBe(2);
    expect(by.time).toBe(4);
    expect(by.calibration).toBe(1);
  });

  it('answers the question the page is actually for', () => {
    // Twelve struggles, one of them about not knowing the material. The
    // instruction that follows is "do not make it harder yet", and this is the
    // figure it rests on.
    const families = errorFamilies([
      mistake('unclear', 1),
      mistake('no-time', 5),
      mistake('distracted', 6),
    ]);
    expect(families.notConceptual).toBe(92);
  });

  it('names a leader only when one is clearly ahead', () => {
    const clear = errorFamilies([mistake('distracted', 8), mistake('unclear', 2)]);
    expect(clear.leading?.key).toBe('execution');

    // 5 against 4 is a twelve-point lead over nine answers. One different
    // afternoon flips it, so it is not a finding and must not be named.
    const tied = errorFamilies([mistake('distracted', 5), mistake('unclear', 4)]);
    expect(tied.leading).toBeNull();
  });

  it('names no leader off a handful of answers, however wide the margin', () => {
    // 4 against 1 is an eighty/twenty split and still five answers. The margin
    // is not the only thing that makes a claim safe.
    const thin = errorFamilies([mistake('distracted', 4), mistake('unclear', 1)]);
    expect(thin.leading).toBeNull();
    // The proportion is still reported: it is what it is, and the brief says
    // what it is out of.
    expect(thin.notConceptual).toBe(80);
  });

  it('is unknown when nothing carries a reason', () => {
    // `rating_depth` is 'ratings' or 'none' — a real setting, and the whole
    // module has to survive it rather than report zeroes as findings.
    expect(errorFamilies([]).known).toBe(false);
    expect(errorFamilies([]).notConceptual).toBe(0);
  });

  it('drops a word it does not know rather than bucketing it', () => {
    const families = errorFamilies([mistake('unclear', 2), mistake('from-the-future', 9)]);
    expect(families.answered).toBe(2);
    expect(families.shares).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
describe('goalGap', () => {
  const DIMENSIONS = [
    dimension('mastery', 70),
    dimension('execution', 50),
    dimension('quality', 40),
    dimension('efficiency', 80),
    dimension('consistency', 60),
    dimension('productivity', 90),
    dimension('momentum', 100),
  ];

  it('splits the shortfall into parts that sum to it exactly', () => {
    // The property the whole reading rests on. If these do not add up, every
    // sentence written from them is a sentence about numbers that disagree.
    const overall = DIMENSIONS.reduce((sum, d) => sum + (d.value ?? 0), 0) / DIMENSIONS.length;
    const gap = goalGap(DIMENSIONS, overall);

    const summed = gap.parts.reduce((sum, part) => sum + part.points, 0);
    expect(summed).toBeCloseTo(gap.total, 1);
    expect(gap.standing + gap.total).toBeCloseTo(100, 0);
  });

  it('puts the largest share where the worst measures are', () => {
    const overall = DIMENSIONS.reduce((sum, d) => sum + (d.value ?? 0), 0) / DIMENSIONS.length;
    const gap = goalGap(DIMENSIONS, overall);
    // Execution 50 and quality 40 are the two worst, and they are one group.
    expect(gap.largest?.key).toBe('execution');
  });

  it('names no largest part when two are level', () => {
    const level = [dimension('mastery', 60), dimension('efficiency', 60)];
    const gap = goalGap(level, 60);
    expect(gap.largest).toBeNull();
  });

  it('ignores a dimension with nothing behind it', () => {
    // An unmeasured dimension must not read as a shortfall of 100. That would
    // make "turning up" the bottleneck on every account that has not logged a
    // session, which is the opposite of the truth.
    const some = [dimension('mastery', 80), dimension('efficiency', null)];
    const gap = goalGap(some, 80);
    expect(gap.total).toBeCloseTo(20, 1);
    expect(gap.parts.every((part) => part.key !== 'time')).toBe(true);
  });

  it('is unknown with nothing measured at all', () => {
    expect(goalGap([], null).known).toBe(false);
  });
});

// ---------------------------------------------------------------------------
describe('calibration', () => {
  it('finds the level that has been outgrown', () => {
    const read = calibration(
      curveOf([
        { level: 2, label: 'Easy', done: 10, execution: 70 },
        { level: 4, label: 'Hard', done: 8, execution: 82 },
      ]),
      NO_TIME,
    );
    expect(read.outgrown.map((rung) => rung.label)).toEqual(['Hard']);
    expect(read.overestimated).toEqual([]);
  });

  it('finds the easy level that is quietly costing the grade', () => {
    const read = calibration(
      curveOf([
        { level: 1, label: 'Trivial', done: 12, execution: 55 },
        { level: 4, label: 'Hard', done: 6, execution: 50 },
      ]),
      NO_TIME,
    );
    expect(read.overestimated.map((rung) => rung.label)).toEqual(['Trivial']);
  });

  it('carries the rushed count through, because it has a different fix', () => {
    const read = calibration(
      curveOf([{ level: 3, label: 'Fair', done: 5, execution: 65 }]),
      { ...NO_TIME, known: true, rushed: 7 },
    );
    expect(read.rushed).toBe(7);
  });

  it('is unknown when no rung has been rated', () => {
    expect(calibration(curveOf([]), NO_TIME).known).toBe(false);
  });
});

// ---------------------------------------------------------------------------
describe('divergence', () => {
  const climbing: Momentum = {
    known: true, change: 12, earlier: 55, later: 67, direction: 'climbing',
  };

  it('reads capability running ahead of the score', () => {
    // The case the module was written for: getting better at harder work
    // while the outcome sits still.
    const read = divergence(climbing, 1);
    expect(read.reading).toBe('capability-ahead');
  });

  it('reads the two moving together', () => {
    expect(divergence(climbing, 10).reading).toBe('together');
  });

  it('reads the outcome running ahead', () => {
    expect(divergence({ ...climbing, change: 1 }, 11).reading).toBe('outcome-ahead');
  });

  it('says nothing without both halves', () => {
    expect(divergence(NO_MOMENTUM, 4).reading).toBe('unknown');
    expect(divergence(climbing, null).known).toBe(false);
  });
});

// ---------------------------------------------------------------------------
describe('performance', () => {
  it('survives a subject with nothing rated', () => {
    // The state a new subject is in, and the one where a module like this is
    // most tempted to report zeroes as findings.
    const read = performance(
      {
        dimensions: [],
        overall: null,
        curve: curveOf([]),
        time: NO_TIME,
        momentum: NO_MOMENTUM,
        mistakes: [],
      },
      null,
    );
    expect(read.families.known).toBe(false);
    expect(read.gap.known).toBe(false);
    expect(read.calibration.known).toBe(false);
    expect(read.divergence.known).toBe(false);
  });
});
