/**
 * How a placement is worded, and why the bottom half is worded differently.
 *
 * The standing panel printed every rank as "Top N%", which is what a
 * percentile is and not what a reader hears. An account with no focus time at
 * all — last of everybody on that measure — was labelled "Top 99%", in the
 * same words, the same size and the same place as the row above it saying
 * "Top 1%" for its best measure. The number was right and the sentence was
 * the opposite of true.
 */
import { describe, expect, it } from 'vitest';
import { rankLabel } from './score';

describe('rankLabel', () => {
  it('says "top" for the better half, where it means what it says', () => {
    expect(rankLabel(1)).toBe('Top 1.0%');
    expect(rankLabel(12)).toBe('Top 12%');
    expect(rankLabel(50)).toBe('Top 50%');
  });

  it('turns the worse half around rather than flattering it', () => {
    // The bug, exactly: last place on a measure, described as if it were first.
    expect(rankLabel(99)).toBe('Bottom 1.0%');
    expect(rankLabel(75)).toBe('Bottom 25%');
  });

  it('turns at the median, so the two halves meet without a gap', () => {
    expect(rankLabel(50)).toBe('Top 50%');
    expect(rankLabel(51)).toBe('Bottom 49%');
  });

  it('never says top 0 or bottom 0 — there is no beyond-everybody', () => {
    for (const percentile of [0, 0.4, 100, 99.9]) {
      const label = rankLabel(percentile);
      expect(label).not.toMatch(/\b0(\.0)?%/);
    }
  });
});
