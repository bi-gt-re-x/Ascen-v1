/**
 * Getting the data out of the analytics page.
 *
 * Both buttons in the header go through one `save` helper, and it had two
 * faults of the same kind — things that work on a small file, on one browser,
 * and fail on exactly the account that needed the export.
 *
 * **The object URL was revoked on the line after `click()`.** Clicking a
 * download link does not read the blob synchronously: the anchor hands the
 * browser a URL and the fetch of it happens after the handler returns. So the
 * revoke was racing the download it had just started — a race won on a report
 * of two kilobytes and lost on the CSV of a five-year account.
 *
 * **The anchor was never in the document.** Firefox ignores `click()` on a
 * detached anchor, which is a button that silently does nothing.
 *
 * Both are invisible to a test that only asks "did a download happen", so what
 * is asserted here is the mechanism: in the document when clicked, and the URL
 * still alive at that moment.
 */
import { fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Header } from './Header';
import { renderWithProviders } from '@/test/render';
import { VIEWS } from './Header';

/** What the anchor looked like at the moment it was clicked. */
let clickedWith: { inDocument: boolean; href: string; download: string } | null = null;
let revoked: string[] = [];
let created: string[] = [];

beforeEach(() => {
  vi.useFakeTimers();
  clickedWith = null;
  revoked = [];
  created = [];

  let n = 0;
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: vi.fn(() => {
      const url = `blob:test/${(n += 1)}`;
      created.push(url);
      return url;
    }),
    revokeObjectURL: vi.fn((url: string) => revoked.push(url)),
  });

  // Record the anchor's state at click time rather than afterwards — the
  // component removes it immediately, which is correct and would hide this.
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    clickedWith = {
      inDocument: document.body.contains(this),
      href: this.href,
      download: this.download,
    };
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function show(overrides = {}) {
  return renderWithProviders(
    <Header
      view={VIEWS[0]}
      span="Sep 13, 2025 – Sep 12, 2026"
      onExport={() => 'a written report'}
      exportName="summit-report-me.txt"
      onExportData={() => 'date,xp\r\n2026-01-01,10'}
      dataName="summit-data-me.csv"
      {...overrides}
    />,
  );
}

const report = () => screen.getByRole('button', { name: /export report/i });
const data = () => screen.getByRole('button', { name: /data \(csv\)/i });

describe('the anchor', () => {
  it('is in the document when it is clicked', () => {
    show();
    fireEvent.click(report());
    expect(clickedWith?.inDocument).toBe(true);
  });

  it('is taken back out again', () => {
    show();
    fireEvent.click(report());
    expect(document.querySelectorAll('a[download]')).toHaveLength(0);
  });

  it('carries the filename it was given', () => {
    show();
    fireEvent.click(data());
    expect(clickedWith?.download).toBe('summit-data-me.csv');
  });
});

describe('the object URL', () => {
  it('is still alive at the moment of the click', () => {
    /* The whole bug: revoking before the browser has fetched the blob aborts
       the download it was asked to start. */
    show();
    fireEvent.click(report());
    expect(revoked).toHaveLength(0);
    expect(clickedWith?.href).toBe(created[0]);
  });

  it('is freed once the download has had time to start', () => {
    /* Deferred, not abandoned — the blob would otherwise be held for the life
       of the document. */
    show();
    fireEvent.click(report());
    vi.advanceTimersByTime(60_000);
    expect(revoked).toEqual([created[0]]);
  });

  it('is not created at all when there is nothing to write', () => {
    show({ onExport: () => null });
    fireEvent.click(report());
    expect(created).toHaveLength(0);
    expect(clickedWith).toBeNull();
  });
});

describe('the buttons', () => {
  it('are disabled when the page has nothing to export', () => {
    show({ onExport: undefined, onExportData: undefined });
    expect(report()).toBeDisabled();
    expect(data()).toBeDisabled();
  });

  it('write the two formats separately', () => {
    show();
    fireEvent.click(data());
    expect(clickedWith?.download).toMatch(/\.csv$/);
    fireEvent.click(report());
    expect(clickedWith?.download).toMatch(/\.txt$/);
    expect(created).toHaveLength(2);
  });
});
