/**
 * The far end of the hidden chain, and the redirect that used to swallow it.
 *
 * The pentagon's arrow sends the reader to `/calendar#void`. Two things have
 * to hold for anything to be waiting there, and only the first is obvious:
 *
 *   * the hook has to read `#void` and empty the page, and
 *   * `/calendar` has to still be `#void` after it has redirected.
 *
 * The second is the one that broke. `/calendar` is an alias for whichever of
 * the three views the account prefers, and the redirect was rebuilding the
 * path without the fragment — so the void opened on arrival and shut again a
 * frame later, when the router came back with a URL that no longer asked for
 * it. The pentagon looked broken; it was the doorway on the other side.
 *
 * That is why the redirect is tested here, beside the hook, rather than
 * wherever else routing might be checked. The two are one behaviour.
 */
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { CalendarHome } from '@/App';
import { useVoid } from './useVoid';
import { renderWithProviders } from '@/test/render';

/** Prints the URL it was reached at, so a test can assert what survived. */
function Landing() {
  const { pathname, search, hash } = useLocation();
  return <div data-testid="here">{pathname + search + hash}</div>;
}

function Void() {
  useVoid();
  return <div>the calendar</div>;
}

afterEach(() => {
  document.documentElement.classList.remove('egg-void');
  document.getElementById('voidRiddle')?.remove();
  document.querySelectorAll('[src*="secret"], [href*="secret"]').forEach((el) => el.remove());
});

describe('arriving at #void', () => {
  it('empties the page', () => {
    render(
      <MemoryRouter initialEntries={['/calendar/week#void']}>
        <Void />
      </MemoryRouter>,
    );
    expect(document.documentElement).toHaveClass('egg-void');
  });

  it('is a normal page without the fragment', () => {
    render(
      <MemoryRouter initialEntries={['/calendar/week']}>
        <Void />
      </MemoryRouter>,
    );
    expect(document.documentElement).not.toHaveClass('egg-void');
  });

  it('hands the page back on the way out', () => {
    const view = render(
      <MemoryRouter initialEntries={['/calendar/week#void']}>
        <Void />
      </MemoryRouter>,
    );
    expect(document.documentElement).toHaveClass('egg-void');

    view.unmount();
    expect(document.documentElement).not.toHaveClass('egg-void');
  });
});

describe('the /calendar redirect', () => {
  it('carries the fragment to the view it lands on', () => {
    // The regression: without this the pentagon's arrow arrives at a calendar
    // with no #void on it, and the void closes as fast as it opened.
    renderWithProviders(
      <Routes>
        <Route path="/calendar" element={<CalendarHome />} />
        <Route path="/calendar/week" element={<Landing />} />
      </Routes>,
      { route: '/calendar#void' },
    );
    expect(screen.getByTestId('here')).toHaveTextContent('/calendar/week#void');
  });

  it('carries the query too, and to the account’s own view', () => {
    renderWithProviders(
      <Routes>
        <Route path="/calendar" element={<CalendarHome />} />
        <Route path="/calendar/month" element={<Landing />} />
      </Routes>,
      { route: '/calendar?day=2026-08-30', settings: { prefs: { calendar_view: 'month' } } },
    );
    expect(screen.getByTestId('here')).toHaveTextContent('/calendar/month?day=2026-08-30');
  });

  it('waits for the account rather than opening the wrong view first', () => {
    renderWithProviders(
      <Routes>
        <Route path="/calendar" element={<CalendarHome />} />
        <Route path="/calendar/week" element={<Landing />} />
      </Routes>,
      { route: '/calendar#void', settings: { ready: false } },
    );
    expect(screen.queryByTestId('here')).not.toBeInTheDocument();
  });
});
