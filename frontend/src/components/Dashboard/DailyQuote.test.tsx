/**
 * The line at the foot of the dashboard, and the secret in it.
 *
 * Two things are being protected here. The first is that the quote is a quote:
 * it paints immediately, it improves when the fetch lands, and it survives the
 * fetch never landing. The second is that ten clicks in the dark replace it —
 * and, just as importantly, that nine do not, and that ten in the light do
 * not either. A secret that goes off by accident is not one.
 *
 * The storage key is asserted literally rather than through
 * utils/easterEgg.ts, because its exact spelling is a contract with three
 * scripts that cannot import it — frontend/secret/pentagon-egg.js,
 * frontend/secret/void.js and frontend/secret/engine.js all rebuild it by
 * hand. A test that computed the key the same way the code does would agree
 * with a rename and let the rest of the chain go quiet.
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DailyQuote } from './DailyQuote';

const daily = vi.hoisted(() => vi.fn());
vi.mock('@/services', () => ({ quote: { daily } }));

const CLUE = '"The pentagon is the key, find it" -Mysterious,,';

/** The day the clock is pinned to, and the key that goes with it. */
const TODAY = new Date('2026-08-30T21:00:00');
const KEY = 'easterEgg:Default:2026-08-30';

function dark(on: boolean) {
  document.documentElement.setAttribute('data-theme', on ? 'dark' : 'light');
}

/** Click the quote `n` times, the way a reader would. */
async function click(user: ReturnType<typeof userEvent.setup>, n: number) {
  const line = document.getElementById('dailyQuote')!;
  for (let i = 0; i < n; i++) await user.click(line);
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(TODAY);
  localStorage.clear();
  dark(true);
  daily.mockResolvedValue({ success: true, quote: 'Keep going.', author: 'Anon' });
});

afterEach(() => {
  vi.useRealTimers();
  document.body.className = '';
  document.documentElement.className = '';
});

describe('the daily quote', () => {
  it('paints a line before the fetch lands, and the fetched one after', async () => {
    render(<DailyQuote />);
    expect(screen.getByText(/getting started/)).toBeInTheDocument();
    expect(await screen.findByText(/Keep going\./)).toBeInTheDocument();
  });

  it('keeps the built-in line when the call fails', async () => {
    daily.mockRejectedValue(new Error('offline'));
    render(<DailyQuote />);
    await waitFor(() => expect(daily).toHaveBeenCalled());
    expect(screen.getByText(/getting started/)).toBeInTheDocument();
  });
});

describe('the hidden quote', () => {
  it('takes ten clicks, and shakes harder on each of the nine', async () => {
    const user = userEvent.setup();
    render(<DailyQuote />);

    await click(user, 1);
    expect(document.documentElement.style.getPropertyValue('--wob')).toBe('2.5px');
    await click(user, 8);
    expect(document.documentElement.style.getPropertyValue('--wob')).toBe('22.5px');

    // Nine is not ten: the day's quote is still the day's quote.
    expect(screen.queryByText(CLUE)).not.toBeInTheDocument();
    expect(localStorage.getItem(KEY)).toBeNull();

    await click(user, 1);
    await vi.advanceTimersByTimeAsync(600); // the slide-out, then the swap
    expect(screen.getByText(CLUE)).toBeInTheDocument();
  });

  it('remembers the unlock under the key the rest of the chain reads', async () => {
    const user = userEvent.setup();
    render(<DailyQuote />);
    await click(user, 10);
    expect(localStorage.getItem(KEY)).toBe('1');
  });

  it('shows the clue again on the next visit, without the theatrics', async () => {
    localStorage.setItem(KEY, '1');
    render(<DailyQuote />);
    expect(screen.getByText(CLUE)).toBeInTheDocument();
    expect(document.body.className).not.toContain('easter-shake');
  });

  it('stays shut in the light, however many times it is clicked', async () => {
    const user = userEvent.setup();
    dark(false);
    render(<DailyQuote />);
    await click(user, 12);
    await vi.advanceTimersByTimeAsync(600);
    expect(screen.queryByText(CLUE)).not.toBeInTheDocument();
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('is retired once the chain has handed out a title', async () => {
    const user = userEvent.setup();
    localStorage.setItem(KEY, '1');
    localStorage.setItem('ascenTitle:Default', 'Admin');
    render(<DailyQuote />);

    expect(screen.queryByText(CLUE)).not.toBeInTheDocument();
    await click(user, 10);
    await vi.advanceTimersByTimeAsync(600);
    expect(screen.queryByText(CLUE)).not.toBeInTheDocument();
  });

  it('leaves nothing on the page when the dashboard is left mid-reveal', async () => {
    const user = userEvent.setup();
    const view = render(<DailyQuote />);
    await click(user, 10);
    view.unmount();
    await vi.advanceTimersByTimeAsync(4000);
    expect(document.body.className).not.toContain('easter-');
    expect(document.getElementById('easterDark')).toBeNull();
  });
});
