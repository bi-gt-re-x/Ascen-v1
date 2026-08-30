/**
 * Whose hidden chain it is.
 *
 * The four scripts in frontend/secret/ identify the reader by one localStorage
 * key, `currentUser`, and for a long time the only thing that ever wrote it was
 * frontend/secret/engine.html — the *last* page in the chain. That made the
 * account meaningless in both directions, and the second direction is the one
 * that bit: once anybody finished the chain on a browser, the name was pinned
 * to them, and the next person to sign in was read as them. Their day's unlock,
 * and their earned title — which retires the chain — so the newcomer found the
 * whole thing already over, with the pentagon on the landing page inert because
 * there was no unlock of theirs to find.
 *
 * These are the tests for that not happening again: the name follows the
 * session, two accounts get two chains, and nobody inherits a stranger's.
 */
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '@/context/contexts';
import { authValue } from '@/test/render';
import { useChainAccount } from './useChainAccount';
import { earnedTitle, markUnlockedToday, unlockedToday } from '@/utils/easterEgg';
import type { AuthValue } from '@/context/contexts';

const TODAY = new Date('2026-08-30T21:00:00');

function Probe() {
  const account = useChainAccount();
  return <span data-testid="who">{account === null ? '(waiting)' : account}</span>;
}

function draw(auth: Partial<AuthValue>) {
  return render(
    <MemoryRouter>
      <AuthContext.Provider value={authValue(auth)}>
        <Probe />
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

const who = () => screen.getByTestId('who').textContent;

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(TODAY);
  localStorage.clear();
});

afterEach(() => vi.useRealTimers());

describe('the name the scripts read', () => {
  it('is the signed-in account', () => {
    draw({ status: 'signed-in', username: 'ada' });
    expect(who()).toBe('ada');
    expect(localStorage.getItem('currentUser')).toBe('ada');
  });

  it('is nobody, and stored as nobody, once signed out', () => {
    localStorage.setItem('currentUser', 'ada');
    draw({ status: 'signed-out', username: null });

    expect(who()).toBe('Default');
    // Removed rather than set to 'Default': a shared machine should not hand
    // the next person the last one's name.
    expect(localStorage.getItem('currentUser')).toBeNull();
  });

  it('says nothing at all while the session is still in flight', () => {
    localStorage.setItem('currentUser', 'ada');
    draw({ status: 'loading', username: null });

    // Not 'Default', and not 'ada' either — the honest answer is "not yet",
    // and every caller waits on it rather than guessing.
    expect(who()).toBe('(waiting)');
    expect(localStorage.getItem('currentUser')).toBe('ada');
  });

  it('follows the session when the account changes under it', () => {
    const view = draw({ status: 'signed-in', username: 'ada' });
    expect(localStorage.getItem('currentUser')).toBe('ada');

    view.rerender(
      <MemoryRouter>
        <AuthContext.Provider value={authValue({ status: 'signed-in', username: 'grace' })}>
          <Probe />
        </AuthContext.Provider>
      </MemoryRouter>,
    );
    expect(who()).toBe('grace');
    expect(localStorage.getItem('currentUser')).toBe('grace');
  });
});

describe('two accounts on one browser', () => {
  it('do not share a day’s unlock', () => {
    markUnlockedToday('ada');

    expect(unlockedToday('ada')).toBe(true);
    expect(unlockedToday('grace')).toBe(false);
  });

  it('do not share an earned title, which is what retires the chain', () => {
    // The exact shape of the old bug: Ada finishes the chain, Grace signs in
    // on the same browser and finds it already over.
    localStorage.setItem('ascenTitle:ada', 'Admin');

    expect(earnedTitle('ada')).toBe('Admin');
    expect(earnedTitle('grace')).toBeNull();
  });

  it('do not share the signed-out visitor’s chain either', () => {
    markUnlockedToday('Default');
    expect(unlockedToday('ada')).toBe(false);
  });
});
