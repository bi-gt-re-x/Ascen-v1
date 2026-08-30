/**
 * The line at the foot of the dashboard, and the secret that replaces it.
 *
 * Two things are being protected. The first is that the quote is a quote: it
 * paints immediately, it improves when the fetch lands, and it survives the
 * fetch never landing. The second is the reveal — which is *not* triggered
 * here any more. The ten clicks are on the rail's title, a component away
 * (hooks/useTitleEgg.ts and components/Rail.egg.test.tsx), and this file tests
 * the two ways the news reaches the quote: a latch, for a dashboard that has
 * to mount on the way, and an event, for one that was already open.
 *
 * The storage key is asserted literally rather than through
 * utils/easterEgg.ts, because its exact spelling is a contract with three
 * scripts that cannot import it — frontend/secret/pentagon-egg.js,
 * frontend/secret/void.js and frontend/secret/engine.js all rebuild it by
 * hand. A test that computed the key the same way the code does would agree
 * with a rename and let the rest of the chain go quiet.
 */
import { act, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DailyQuote } from './DailyQuote';
import { renderWithProviders } from '@/test/render';
import { EGG_UNLOCKED, armReveal, takeReveal } from '@/utils/easterEgg';

const daily = vi.hoisted(() => vi.fn());
vi.mock('@/services', () => ({ quote: { daily } }));

const CLUE = '"The pentagon is the key, find it" -Mysterious,,';

const TODAY = new Date('2026-08-30T21:00:00');

/* The signed-in account, not 'Default': the chain is per-account, and 'myles'
   is who components/../test/render.tsx signs in as. A test that still passed
   against 'Default' would be a test that had stopped noticing whose progress
   it was reading. */
const KEY = 'easterEgg:myles:2026-08-30';

/** The whole reveal, from the slide-out to the spotlight lifting. */
const WHOLE_REVEAL = 4000;

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(TODAY);
  localStorage.clear();
  takeReveal(); // the latch is module state; do not let one test arm another
  daily.mockResolvedValue({ success: true, quote: 'Keep going.', author: 'Anon' });
});

afterEach(() => {
  vi.useRealTimers();
  document.body.className = '';
  document.documentElement.className = '';
  document.getElementById('easterDark')?.remove();
});

describe('the daily quote', () => {
  it('paints a line before the fetch lands, and the fetched one after', async () => {
    renderWithProviders(<DailyQuote />);
    expect(screen.getByText(/getting started/)).toBeInTheDocument();
    expect(await screen.findByText(/Keep going\./)).toBeInTheDocument();
  });

  it('keeps the built-in line when the call fails', async () => {
    daily.mockRejectedValue(new Error('offline'));
    renderWithProviders(<DailyQuote />);
    await waitFor(() => expect(daily).toHaveBeenCalled());
    expect(screen.getByText(/getting started/)).toBeInTheDocument();
  });

  it('is not a way in on its own — clicking it does nothing', async () => {
    renderWithProviders(<DailyQuote />);
    const line = document.getElementById('dailyQuote')!;
    for (let i = 0; i < 12; i++) line.click();
    expect(screen.queryByText(CLUE)).not.toBeInTheDocument();
    expect(localStorage.getItem(KEY)).toBeNull();
  });
});

describe('the hidden quote', () => {
  it('plays the whole reveal for a dashboard that mounts owing one', async () => {
    localStorage.setItem(KEY, '1');
    armReveal();
    renderWithProviders(<DailyQuote />);

    // The old line leaves first; the clue is not there yet.
    expect(document.getElementById('dailyQuote')).toHaveClass('quote-slide-out');
    expect(screen.queryByText(CLUE)).not.toBeInTheDocument();

    await act(() => vi.advanceTimersByTimeAsync(600));
    expect(screen.getByText(CLUE)).toBeInTheDocument();
    expect(document.body.className).toContain('easter-shake');
    expect(document.getElementById('easterDark')).toHaveClass('show');

    // …and the page is handed back: no shake, no scrim, the clue still lit.
    await act(() => vi.advanceTimersByTimeAsync(WHOLE_REVEAL));
    expect(screen.getByText(CLUE)).toBeInTheDocument();
    expect(document.body.className).not.toContain('easter-shake');
    expect(document.getElementById('easterDark')).toBeNull();
  });

  it('plays it on the announcement for a dashboard already open', async () => {
    renderWithProviders(<DailyQuote />);
    expect(screen.queryByText(CLUE)).not.toBeInTheDocument();

    localStorage.setItem(KEY, '1');
    armReveal();
    await act(async () => {
      window.dispatchEvent(new CustomEvent(EGG_UNLOCKED));
    });
    await act(() => vi.advanceTimersByTimeAsync(600));

    expect(screen.getByText(CLUE)).toBeInTheDocument();
  });

  it('plays it once, however the news arrives', async () => {
    localStorage.setItem(KEY, '1');
    armReveal();
    renderWithProviders(<DailyQuote />);
    await act(() => vi.advanceTimersByTimeAsync(WHOLE_REVEAL));

    // The latch is spent, so a second announcement is not a second show.
    await act(async () => {
      window.dispatchEvent(new CustomEvent(EGG_UNLOCKED));
    });
    expect(document.getElementById('dailyQuote')).not.toHaveClass('quote-slide-out');
    expect(screen.getByText(CLUE)).toBeInTheDocument();
  });

  it('shows the clue again on the next visit, without the theatrics', () => {
    localStorage.setItem(KEY, '1');
    renderWithProviders(<DailyQuote />);

    expect(screen.getByText(CLUE)).toBeInTheDocument();
    expect(document.body.className).not.toContain('easter-shake');
    expect(document.getElementById('dailyQuote')).not.toHaveClass('quote-slide-out');
  });

  it('is retired once the chain has handed out a title', async () => {
    localStorage.setItem(KEY, '1');
    localStorage.setItem('ascenTitle:myles', 'Admin');
    armReveal();
    renderWithProviders(<DailyQuote />);

    await act(() => vi.advanceTimersByTimeAsync(WHOLE_REVEAL));
    expect(screen.queryByText(CLUE)).not.toBeInTheDocument();
  });

  it('leaves nothing on the page when the dashboard is left mid-reveal', async () => {
    localStorage.setItem(KEY, '1');
    armReveal();
    const view = renderWithProviders(<DailyQuote />);

    view.unmount();
    await act(() => vi.advanceTimersByTimeAsync(WHOLE_REVEAL));

    expect(document.body.className).not.toContain('easter-');
    expect(document.getElementById('easterDark')).toBeNull();
  });
});
