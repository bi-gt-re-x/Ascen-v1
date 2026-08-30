/**
 * The boundary the harshness setting moves, and the one it does not.
 *
 * The whole case for offering a tone control is that it is editorial: it
 * decides where a shortfall starts being called a shortfall and how much is
 * put in front of the reader at once, and it never touches a figure. That is a
 * promise a future edit can quietly break — a `pct * 1.1` inside `verdict`
 * would pass every type check and make the page's numbers a function of the
 * reader's mood, which is the one thing this page cannot afford.
 *
 * So the tests are the grace boundary, in both directions, at all three
 * levels, plus the statement that the *gap* printed alongside is the same
 * number whatever the tone. See ./analyticsPrefs.
 */
import { describe, expect, it } from 'vitest';
import { TONE_RULES, detailRules, toneRules, verdict } from './analyticsPrefs';

describe('the grace boundary', () => {
  it('calls anything at or over the target met, at every tone', () => {
    for (const tone of ['gentle', 'balanced', 'harsh'] as const) {
      expect(verdict(tone, 100).met).toBe(true);
      expect(verdict(tone, 140).met).toBe(true);
    }
  });

  it('gives gentle fifteen points and blunt none', () => {
    // One point inside each level's grace, and one point outside it.
    expect(verdict('gentle', 86).met).toBe(true);
    expect(verdict('gentle', 84).met).toBe(false);

    expect(verdict('balanced', 96).met).toBe(true);
    expect(verdict('balanced', 94).met).toBe(false);

    // Blunt has no grace at all: 99% of the target is 1% short.
    expect(verdict('harsh', 99).met).toBe(false);
    expect(verdict('harsh', 99).label).toBe('1% short');
  });

  it('prints the same gap whatever the tone', () => {
    // The word changes — "near enough" against "15% short" — and the number
    // behind it does not. A tone that rounded in the reader's favour would
    // show up right here.
    expect(verdict('gentle', 85).met).toBe(true);
    expect(verdict('harsh', 85).label).toBe('15% short');
    expect(verdict('balanced', 85).label).toBe('15% short');
  });

  it('never prints a shortfall of nothing', () => {
    // 99.6% floors to "0% short" without the guard, which reads as a bug.
    expect(verdict('harsh', 99.6).label).toBe('1% short');
  });

  it('falls back to balanced on a value it does not know', () => {
    // The stored value is a string from a database and this module is where a
    // hand-edited row stops being a problem.
    expect(toneRules(undefined)).toEqual(TONE_RULES.balanced);
    expect(verdict(undefined, 96).met).toBe(true);
    expect(verdict(undefined, 94).met).toBe(false);
  });
});

describe('how much is put in front of the reader', () => {
  it('rises with the tone and never falls to nothing', () => {
    const levels = (['gentle', 'balanced', 'harsh'] as const).map((tone) => toneRules(tone));
    for (let at = 1; at < levels.length; at += 1) {
      expect(levels[at]!.headlines).toBeGreaterThan(levels[at - 1]!.headlines);
      expect(levels[at]!.diagnoses).toBeGreaterThan(levels[at - 1]!.diagnoses);
    }
    // Even the gentlest page still says something. A level that showed zero
    // recommendations would be a page that had stopped doing its job.
    expect(levels[0]!.headlines).toBeGreaterThan(0);
  });
});

describe('how much of the page is drawn', () => {
  it('is a ladder — nothing is dropped by asking for more', () => {
    const less = detailRules('essentials');
    const same = detailRules('standard');
    const more = detailRules('everything');

    expect(less.quality).toBe(false);
    expect(same.quality).toBe(true);
    expect(more.quality).toBe(true);
    expect(same.extras).toBe(false);
    expect(more.extras).toBe(true);
  });

  it('falls back to standard, which is the page as it was', () => {
    expect(detailRules(undefined)).toEqual(detailRules('standard'));
  });
});
