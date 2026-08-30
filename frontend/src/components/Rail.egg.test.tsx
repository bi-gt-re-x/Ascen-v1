/**
 * The rail's title: the door into the hidden chain, and the menu beside it.
 *
 * Two unrelated things share one row, and the tests are mostly about keeping
 * them unrelated. The three dots are a feature — pick which of the titles you
 * have earned the rail should print. The title itself is a secret: ten clicks
 * in the dark open the chain. Neither should be discoverable by using the
 * other, which is why the silence of the first three clicks is asserted as
 * carefully as the tremble of the fourth.
 *
 * The storage keys are written out literally rather than built from
 * utils/easterEgg.ts, because their exact spelling is a contract with three
 * scripts that cannot import a module — frontend/secret/pentagon-egg.js,
 * frontend/secret/void.js and frontend/secret/engine.js all rebuild them by
 * hand. A test that derived the key the same way the code does would agree
 * with a rename and let the rest of the chain go quiet.
 */
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Rail } from './Rail';
import { renderWithProviders } from '@/test/render';
import { setMatchMedia } from '@/test/media';
import { stats } from '@/test/factories';

const PHONE = '(max-width: 640px)';

/** 100 x n per level, so level 12 is 100 x (1+…+11). Level 12 is Apprentice. */
const LEVEL_12 = 6600;

const TODAY = new Date('2026-08-30T21:00:00');
const KEY = 'easterEgg:Default:2026-08-30';

const navigate = vi.hoisted(() => vi.fn());
vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual<typeof import('react-router-dom')>('react-router-dom')),
  useNavigate: () => navigate,
}));

function dark(on: boolean) {
  document.documentElement.setAttribute('data-theme', on ? 'dark' : 'light');
}

function draw(xp = LEVEL_12) {
  return renderWithProviders(<Rail />, { stats: { stats: stats({ xp }) } });
}

/** The rail's title. Deliberately not a button, so it is found by its text. */
function title() {
  return document.querySelector('.rail-rank-title') as HTMLElement;
}

async function click(user: ReturnType<typeof userEvent.setup>, n: number) {
  for (let i = 0; i < n; i++) await user.click(title());
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(TODAY);
  setMatchMedia({ [PHONE]: false });
  localStorage.clear();
  navigate.mockClear();
  dark(true);
});

afterEach(() => {
  vi.useRealTimers();
  document.body.className = '';
  document.documentElement.className = '';
  document.documentElement.removeAttribute('style');
});

describe('the way into the hidden chain', () => {
  it('does nothing at all for the first three clicks', async () => {
    const user = userEvent.setup();
    draw();

    await click(user, 3);

    // No tremble, no wobble, and nothing written down. As far as anyone
    // pressing their own rank twice can tell, it is a label.
    expect(title()).not.toHaveClass('title-tremble');
    expect(document.body.className).not.toContain('easter-wobble');
    expect(document.documentElement.style.getPropertyValue('--wob')).toBe('');
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('starts trembling on the fourth, and harder with each one after', async () => {
    const user = userEvent.setup();
    draw();

    await click(user, 4);
    expect(title()).toHaveClass('title-tremble');
    // The fourth is the first that shows anything, so it is the smallest.
    expect(title().style.getPropertyValue('--tremble')).toBe('0.60px');
    expect(document.documentElement.style.getPropertyValue('--wob')).toBe('2.20px');

    await click(user, 5);
    expect(title().style.getPropertyValue('--tremble')).toBe('3.60px');
    expect(document.documentElement.style.getPropertyValue('--wob')).toBe('13.20px');
  });

  it('opens on the tenth, and takes the reader to where the clue is', async () => {
    const user = userEvent.setup();
    draw();

    await click(user, 9);
    expect(localStorage.getItem(KEY)).toBeNull();
    expect(navigate).not.toHaveBeenCalled();

    await click(user, 1);
    expect(localStorage.getItem(KEY)).toBe('1');
    expect(navigate).toHaveBeenCalledWith('/dashboard');
  });

  it('stays shut in the light, however many times it is clicked', async () => {
    const user = userEvent.setup();
    dark(false);
    draw();

    await click(user, 12);

    expect(localStorage.getItem(KEY)).toBeNull();
    expect(navigate).not.toHaveBeenCalled();
    expect(title()).not.toHaveClass('title-tremble');
  });

  it('is retired once the chain has handed out a title', async () => {
    const user = userEvent.setup();
    localStorage.setItem('ascenTitle:Default', 'Admin');
    draw();

    await click(user, 12);

    expect(localStorage.getItem(KEY)).toBeNull();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('leaves no shake on the page when the rail goes', async () => {
    const user = userEvent.setup();
    const view = draw();
    await click(user, 5);

    view.unmount();
    await vi.advanceTimersByTimeAsync(1000);

    expect(document.body.className).not.toContain('easter-wobble');
    expect(document.documentElement.className).not.toContain('easter-shake-clip');
  });
});

describe('choosing a title', () => {
  it('offers every band reached, best first, and never one ahead', async () => {
    const user = userEvent.setup();
    draw(); // level 12 — Beginner, Novice, Apprentice

    await user.click(screen.getByRole('button', { name: 'Choose your title' }));
    const menu = screen.getByRole('menu');
    const names = within(menu)
      .getAllByRole('menuitemradio')
      .map((el) => el.textContent);

    expect(names).toEqual([
      'AutomaticApprentice',
      'Apprentice',
      'Novice',
      'Beginner',
    ]);
    expect(within(menu).queryByText('Adept')).not.toBeInTheDocument();
  });

  it('prints the one that is picked, and remembers it', async () => {
    const user = userEvent.setup();
    draw();
    expect(title()).toHaveTextContent('Apprentice');

    await user.click(screen.getByRole('button', { name: 'Choose your title' }));
    await user.click(screen.getByRole('menuitemradio', { name: 'Novice' }));

    expect(title()).toHaveTextContent('Novice');
    expect(localStorage.getItem('ascenRankTitle:myles')).toBe('Novice');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('goes back to following the level, and stops storing a choice', async () => {
    const user = userEvent.setup();
    localStorage.setItem('ascenRankTitle:myles', 'Beginner');
    draw();
    expect(title()).toHaveTextContent('Beginner');

    await user.click(screen.getByRole('button', { name: 'Choose your title' }));
    await user.click(screen.getByRole('menuitemradio', { name: /Automatic/ }));

    expect(title()).toHaveTextContent('Apprentice');
    expect(localStorage.getItem('ascenRankTitle:myles')).toBeNull();
  });

  it('offers the title the hidden chain hands out, ahead of the bands', async () => {
    const user = userEvent.setup();
    localStorage.setItem('ascenTitle:Default', 'Admin');
    draw();

    await user.click(screen.getByRole('button', { name: 'Choose your title' }));
    const names = within(screen.getByRole('menu'))
      .getAllByRole('menuitemradio')
      .map((el) => el.textContent);

    expect(names[1]).toBe('Admin');
  });

  it('falls back to the band when a chosen title is no longer held', () => {
    // The secret title was picked and then cleared out of storage — by the
    // engine, or by a browser wipe. The rail says what is true now.
    localStorage.setItem('ascenRankTitle:myles', 'Admin');
    draw();
    expect(title()).toHaveTextContent('Apprentice');
  });

  it('clicking the dots is not clicking the title', async () => {
    const user = userEvent.setup();
    draw();

    for (let i = 0; i < 12; i++) {
      await user.click(screen.getByRole('button', { name: 'Choose your title' }));
    }

    expect(localStorage.getItem(KEY)).toBeNull();
    expect(navigate).not.toHaveBeenCalled();
  });
});
