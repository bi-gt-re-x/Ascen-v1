/**
 * The question phase, and the two promises it makes.
 *
 * **One write, at the end.** Seven screens, two stores, and an account that
 * closed the tab on step three should be exactly as unconfigured as one that
 * never opened the page. That is a property of the whole flow rather than of
 * any one step, so it is checked by walking the flow.
 *
 * **The count is the steps that exist.** The subject question is dropped on an
 * account with no subjects, and the rail and the "Step n of m" have to agree
 * with that — a flow that says "Step 4 of 7" and then finishes on 6 is the
 * failure a hard-coded length produces, and it is invisible to the compiler.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AnalyticsSetup } from './Setup';
import { DEFAULTS } from '@/services/settings';
import type { SetupAnswers, SetupPrefs } from './Setup';

const PREFS: SetupPrefs = {
  analytics_log_style: DEFAULTS.analytics_log_style,
  analytics_tone: DEFAULTS.analytics_tone,
  analytics_detail: DEFAULTS.analytics_detail,
  analytics_home_tab: DEFAULTS.analytics_home_tab,
};

const SUBJECTS = [{ id: 'maths', label: 'Mathematics' }];

/* Typed against the prop rather than inferred from the arrow: `vi.fn(async ()
   => true)` infers a nullary mock, and `mock.calls[0][0]` on one of those is a
   type error even though the call is real. */
function saver() {
  return vi.fn<(answers: SetupAnswers) => Promise<boolean>>(async () => true);
}

function draw(over: Partial<React.ComponentProps<typeof AnalyticsSetup>> = {}) {
  const onSave = saver();
  render(<AnalyticsSetup subjects={SUBJECTS} prefs={PREFS} onSave={onSave} {...over} />);
  return { onSave };
}

/** Walk to the last step. The flow is linear, so this is just Next until the
 *  finish button appears. */
async function toTheEnd(user: ReturnType<typeof userEvent.setup>) {
  for (let step = 0; step < 10; step += 1) {
    const next = screen.queryByRole('button', { name: 'Next' });
    if (!next) return;
    await user.click(next);
  }
}

describe('the analytics question phase', () => {
  it('asks seven with a catalogue and six without', () => {
    const { unmount } = render(
      <AnalyticsSetup subjects={SUBJECTS} prefs={PREFS} onSave={saver()} />,
    );
    expect(screen.getByText(/Step 1 of 7/)).toBeInTheDocument();
    unmount();

    render(<AnalyticsSetup subjects={[]} prefs={PREFS} onSave={saver()} />);
    expect(screen.getByText(/Step 1 of 6/)).toBeInTheDocument();
  });

  it('writes nothing until the last step', async () => {
    const user = userEvent.setup();
    const { onSave } = draw();

    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(onSave).not.toHaveBeenCalled();
  });

  it('sends the baseline and the preferences together', async () => {
    const user = userEvent.setup();
    const { onSave } = draw();

    // Step one: how work is recorded.
    await user.click(screen.getByRole('button', { name: /Sessions/ }));
    await user.click(screen.getByRole('button', { name: 'Next' }));

    // Step two: days a week.
    await user.click(screen.getByRole('button', { name: '3' }));

    await toTheEnd(user);
    await user.click(screen.getByRole('button', { name: /open my analytics/i }));

    expect(onSave).toHaveBeenCalledTimes(1);
    const answers = onSave.mock.calls[0]![0];
    expect(answers.baseline.active_days).toBe(3);
    expect(answers.prefs.analytics_log_style).toBe('sessions');
    // Untouched questions still travel, at the value they were shown at —
    // a partial write would leave the page half-configured.
    expect(answers.prefs.analytics_tone).toBe(DEFAULTS.analytics_tone);
    expect(answers.baseline.session_minutes).toBe(60);
  });

  it('can be left from any step, not only the first', async () => {
    const user = userEvent.setup();
    const onSkip = vi.fn();
    draw({ onSkip });

    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(screen.getByRole('button', { name: /skip the rest/i }));
    expect(onSkip).toHaveBeenCalled();
  });

  it('opens on the answers already given when it is an edit', async () => {
    const user = userEvent.setup();
    draw({
      current: { active_days: 2, session_minutes: 25, focus_subject: 'maths' },
      setOn: '2026-08-01',
      onSkip: vi.fn(),
    });
    expect(screen.getByText(/Your answers/)).toBeInTheDocument();
    // And the way out is a cancel rather than a skip: there is nothing to skip
    // past, the page underneath is already configured.
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /skip the rest/i })).not.toBeInTheDocument();

    // The questions still have their answers in them — the reader came back to
    // change one, not to start again.
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('button', { name: '2', pressed: true })).toBeInTheDocument();
  });
});
