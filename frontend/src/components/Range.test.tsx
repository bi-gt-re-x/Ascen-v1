/**
 * The generated ridgelines.
 *
 * A drawing usually does not need a test — that a path renders is not worth
 * pinning, and how it looks is not a thing an assertion can hold. This one is
 * different, because the shapes are *computed*: every page's scenery comes out
 * of one generator seeded on the page's name, and three of the properties that
 * make the output read as mountains rather than as noise are arithmetic that
 * can silently stop being true.
 *
 * - **A variant is a place.** The same name has to give the same range on
 *   every render and every reload, or the page's own landscape changes while
 *   somebody is looking at it. That is the memo and the seeded generator; a
 *   stray `Math.random` would pass every visual check and fail this.
 * - **Two names are two places.** The whole reason for a generator instead of
 *   the three hand-placed ridges it replaced was that twelve pages must not
 *   share one wallpaper.
 * - **A ridge has summits.** The bands the generator draws from do not
 *   overlap, so the points must strictly alternate high-low-high. When they
 *   stop doing that, `ridge` rounds the wrong corners — it gives a summit a
 *   3.5-unit radius and a saddle a 13-unit one — and the range turns into
 *   hills without anything throwing.
 */
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Range } from './Range';

/** Every ridgeline path in one drawing, far to near. */
function ridges(container: HTMLElement): string[] {
  return [...container.querySelectorAll('.peak-layer')].map((layer) => {
    const path = layer.querySelector('path');
    return path?.getAttribute('d') ?? '';
  });
}

/**
 * The points a path passes through, as `[x, y]`.
 *
 * `ridge` writes a line-to and a quadratic per corner, so the control point of
 * each `Q` is the corner itself — that is the summit or the saddle, and the
 * `L` before it is only the run-in to the curve.
 */
function corners(d: string): Array<[number, number]> {
  return [...d.matchAll(/Q(-?[\d.]+) (-?[\d.]+)/g)].map((hit) => [
    Number(hit[1]),
    Number(hit[2]),
  ]);
}

describe('Range', () => {
  it('draws the same mountains for the same variant', () => {
    const first = render(<Range variant="analytics-overview" />);
    const second = render(<Range variant="analytics-overview" />);

    expect(ridges(first.container)).toEqual(ridges(second.container));
    expect(ridges(first.container)[0]).not.toBe('');
  });

  it('draws different mountains for different variants', () => {
    const tasks = render(<Range variant="tasks" />).container;
    const goals = render(<Range variant="goals" />).container;

    // Every layer differs, not just one — two ranges that share their
    // foreground read as the same place seen twice.
    ridges(tasks).forEach((path, layer) => {
      expect(path).not.toEqual(ridges(goals)[layer]);
    });
  });

  it('alternates summits and saddles on every ridge', () => {
    // Several names rather than one: the generator is seeded, so a single
    // variant only ever proves that one seed came out well.
    for (const variant of ['tasks', 'goals', 'notes', 'records', 'focus']) {
      const { container } = render(<Range variant={variant} />);

      for (const path of ridges(container)) {
        const points = corners(path);
        expect(points.length).toBeGreaterThanOrEqual(3);

        points.forEach(([x, y], at) => {
          expect(Number.isFinite(x)).toBe(true);
          expect(Number.isFinite(y)).toBe(true);
          if (at === 0) return;
          const before = points[at - 1]![1];
          /* The two ends of a ridge sit on the box edges and stay square, so
             they are not corners and are not in this list — which makes the
             first entry a summit and every odd one after it a saddle. Down the
             page is a larger y, so a summit is the *smaller* number. */
          if (at % 2) expect(y).toBeGreaterThan(before);
          else expect(y).toBeLessThan(before);
        });
      }
    }
  });

  it('runs each ridge past both edges of the box', () => {
    // The layers drift a few units sideways for ever (styles/summit.css). The
    // overshoot is what stops one of them pulling its own end into view.
    const { container } = render(<Range variant="dashboard" />);

    for (const path of ridges(container)) {
      expect(path.startsWith('M-8 ')).toBe(true);
      expect(path).toContain('L428 ');
    }
  });

  it('says nothing to a screen reader', () => {
    const { container } = render(<Range variant="settings" />);
    expect(container.querySelector('.peak-scene')?.getAttribute('aria-hidden')).toBe('true');
  });
});
