/**
 * The one tested part of the landing page, and the reason is arithmetic.
 *
 * Nothing else in components/Home has a test, correctly: they are demonstrations
 * whose whole content is timing and movement, and a test that a card slid in
 * from the left is a test of jsdom. This section is the exception because it
 * states two *derived* figures — the score is the mean of the five bars beside
 * it, and the standing is `components/Analytics/score` placing that score. Both
 * would go on rendering something plausible after a drift, which is the kind of
 * wrong that no reviewer catches.
 *
 * The last two cases cover the arming, which is the part the browser could not
 * be made to show: the panel ships empty, fills a paint after it is scrolled to,
 * lights its tab strip once the numbers have run, and empties again when it
 * leaves — and, where there is no IntersectionObserver to wait for, is simply
 * finished on arrival.
 */
import { render, screen, act } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Analytics } from './Analytics';
import { percentileLabel } from '@/components/Analytics/score';

/** Drive the IntersectionObserver the component arms itself with. */
function stubIO() {
  const entries: Array<(e: unknown[]) => void> = [];
  class IO {
    cb: (e: unknown[]) => void;
    constructor(cb: (e: unknown[]) => void) {
      this.cb = cb;
      entries.push(cb);
    }
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal('IntersectionObserver', IO);
  return {
    enter: (el: Element) =>
      entries.forEach((cb) => cb([{ isIntersecting: true, target: el, intersectionRatio: 1 }])),
    leave: (el: Element) =>
      entries.forEach((cb) => cb([{ isIntersecting: false, target: el, intersectionRatio: 0 }])),
  };
}

describe('the landing page analytics panel', () => {
  it('states a score that is the mean of the bars it draws', () => {
    render(<Analytics />);
    // 92 + 78 + 85 + 71 + 88 = 414; /5 = 82.8; /10 = 8.28 -> "8.3"
    expect(screen.getByText('8.3')).toBeInTheDocument();
    const bars = [92, 78, 85, 71, 88];
    bars.forEach((v) => expect(screen.getByText(String(v))).toBeInTheDocument());
    const mean = bars.reduce((a, b) => a + b, 0) / bars.length / 10;
    expect((8.28).toFixed(1)).toBe(mean.toFixed(1));
  });

  it('places the score with the real percentile model', () => {
    render(<Analytics />);
    const expected = percentileLabel(8.28);
    expect(expected).toBe('Top 2.1%');
    expect(screen.getByText(expected as string)).toBeInTheDocument();
  });

  it('names the seven tabs the analytics page has, in order', () => {
    render(<Analytics />);
    const tabs = document.querySelectorAll('.lp-ax-tab');
    expect([...tabs].map((t) => t.textContent)).toEqual([
      'Recommendations',
      'Overview',
      'Trends',
      'Habits',
      'Insights',
      'Subjects',
      'Records',
    ]);
  });

  it('writes each bar its own width and stagger', () => {
    render(<Analytics />);
    const bars = [...document.querySelectorAll<HTMLElement>('.lp-ax-track i')];
    expect(bars.map((b) => b.style.getPropertyValue('--ax-to'))).toEqual([
      '92%', '78%', '85%', '71%', '88%',
    ]);
    expect(bars.map((b) => b.style.transitionDelay)).toEqual([
      '0ms', '90ms', '180ms', '270ms', '360ms',
    ]);
  });

  it('ships armed, unarms a paint after it is scrolled to, and re-arms when it leaves', async () => {
    const io = stubIO();
    render(<Analytics />);
    const panel = document.querySelector('.lp-ax') as HTMLElement;
    expect(panel.classList.contains('ax-armed')).toBe(true);

    await act(async () => {
      io.enter(panel);
      // afterPaint is two nested rAFs; jsdom runs them on timers.
      await new Promise((r) => setTimeout(r, 60));
    });
    expect(panel.classList.contains('ax-armed')).toBe(false);

    await act(async () => {
      await new Promise((r) => setTimeout(r, 1000));
    });
    expect(panel.classList.contains('ax-lit')).toBe(true);

    await act(async () => {
      io.leave(panel);
    });
    expect(panel.classList.contains('ax-armed')).toBe(true);
  });

  it('with no IntersectionObserver, shows the finished panel at once', () => {
    const had = Reflect.get(window, 'IntersectionObserver');
    Reflect.deleteProperty(window, 'IntersectionObserver');
    render(<Analytics />);
    Reflect.set(window, 'IntersectionObserver', had);
    const panel = document.querySelector('.lp-ax') as HTMLElement;
    expect(panel.classList.contains('ax-armed')).toBe(false);
    expect(panel.classList.contains('ax-lit')).toBe(true);
    expect(screen.getByText('8.3')).toBeInTheDocument();
  });
});
