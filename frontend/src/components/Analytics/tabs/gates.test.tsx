/**
 * The gates, which are what the extraction could most easily have broken.
 *
 * Four of the seven tabs refuse to draw until the account has enough record,
 * and each refuses on a different number for a different reason. Pulling the
 * tab bodies out of the page moved every one of those conditions across a file
 * boundary — a mechanical change that TypeScript cannot check, because
 * `waitFor('habits') === 0` and `waitFor('habits') > 0` are both perfectly
 * typed and only one of them is right.
 *
 * So this is a boundary test, not a coverage one: at exactly the day the tab
 * unlocks, and at one day short of it. A tab that quietly inverted a condition
 * in the move would pass every type check and fail here.
 *
 * The model is faked rather than driven through `useAnalyticsModel`. The tabs
 * are presentation — they read figures and lay them out — so the thing worth
 * pinning is what they do with a given set of figures, and building the real
 * model would mean fabricating a year of day series to move one number.
 */
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { ReactElement } from 'react';
import { HabitsTab } from './HabitsTab';
import { InsightsTab } from './InsightsTab';
import { RecommendationsTab } from './RecommendationsTab';
import { SubjectsTab } from './SubjectsTab';
import { NEED_DAYS } from '../useAnalyticsModel';
import { TONE_RULES } from '@/utils/analyticsPrefs';
import { balanceShape, clockShape, rhythmShape, weekShape } from '@/utils/behaviour';
import { buildHabits, habitSummary } from '@/utils/habits';
import { currentState } from '@/utils/insight';
import { summariseRatings, summariseReasons } from '@/utils/ratings';
import { reviewAdopted, summarise } from '@/utils/followup';
import { days, task } from '@/test/factories';
import type { AnalyticsData } from '../useAnalyticsData';
import type { AnalyticsModel } from '../useAnalyticsModel';

const nameOf = (id: string) => id;

/*
 * The empty shapes come from the real constructors rather than from literals.
 *
 * `weekShape([])` is what the page hands these panels on an account with no
 * record, so it is the honest empty value — and, unlike a hand-written object,
 * it cannot fall out of step with the type when a field is added to it.
 */
const EMPTY = {
  week: weekShape([]),
  clock: clockShape([]),
  rhythm: rhythmShape([]),
  balance: balanceShape([], nameOf, '', ''),
  qualitySummary: summariseRatings([], '', ''),
  reasons: summariseReasons([], '', ''),
};

/**
 * A model with every figure empty, and the gates open.
 *
 * `historyDays` is the one knob most of these tests turn. `waitFor` is derived
 * from it here exactly as the real model derives it, so a test that sets
 * `historyDays` gets a consistent answer from both.
 */
function fakeModel(over: Partial<AnalyticsModel> = {}): AnalyticsModel {
  const historyDays = over.historyDays ?? 400;
  const base = {
    historyDays,
    waitFor: (key: keyof typeof NEED_DAYS) => Math.max(0, NEED_DAYS[key] - historyDays),
    streak: 0,
    all: [],
    tasks: [],
    slice: { current: [], previous: [] },
    toIso: '2026-08-01',
    spanText: 'the last 90 days',
    span: '90',
    // Habits
    habits: [],
    byDate: new Map(),
    patterns: [],
    shifts: [],
    summary: habitSummary([], []),
    // Insights
    ...EMPTY,
    why: [], how: [], wins: [], links: [],
    state: currentState([], EMPTY.rhythm, EMPTY.week, EMPTY.balance),
    insights: [], discovered: [], rated: [],
    reasonRows: [], ratingDepth: 'ratings',
    breakdown: { rows: [], total: 0 }, previousBySubject: new Map(),
    aimedShare: null,
    // Recommendations
    advice: [], shown: [], projection: {}, plan: { actions: [], budget: 60 },
    diagnoses: [], recent: { current: [], previous: [] }, weekLeft: 3,
    reviews: [], reviewSummary: {}, adoptedIds: new Set(), goalAdvice: [],
    category: '', setCategory: vi.fn(), setBudget: vi.fn(), setNudge: vi.fn(),
    // Subjects
    namedSubjects: { total: 0, named: 0 },
    /* The real model sets this on every render — `useAnalyticsModel` derives it
       from the stored tone and `toneRules()` falls back to balanced — so a fake
       without it is a fake of a model that cannot exist. It went unnoticed while
       no tab here read it; Habits and Goals do now. See ./tone.test.tsx. */
    toneRules: TONE_RULES.balanced,
  };
  return { ...base, ...over } as unknown as AnalyticsModel;
}

function fakeData(): AnalyticsData {
  return {
    goals: { data: { goals: [] }, loading: false },
    adopt: vi.fn(),
    adopting: null,
    justAdopted: null,
    dropAdopted: vi.fn(),
    dropping: null,
    refresh: vi.fn(),
  } as unknown as AnalyticsData;
}

const subjects = new Map();

function draw(ui: ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('Habits', () => {
  it('is locked one day short of the record it needs', () => {
    draw(<HabitsTab model={fakeModel({ historyDays: NEED_DAYS.habits - 1 })} subjects={subjects} />);
    expect(screen.getByText(/needs weeks of repetition/i)).toBeInTheDocument();
  });

  it('is still locked on the day it unlocks, when nothing repeats yet', () => {
    // Two conditions, not one: enough record *and* a habit found in it. The
    // same panel covers both, and says which it is waiting on.
    draw(<HabitsTab model={fakeModel({ historyDays: NEED_DAYS.habits, habits: [] })} subjects={subjects} />);
    expect(screen.getByText(/Nothing repeats often enough yet/i)).toBeInTheDocument();
  });

  it('draws once there is both enough record and a habit', () => {
    // A real habit, built by the real builder from tasks that actually repeat —
    // eight weekly "Revision" completions, which is what `buildHabits` needs to
    // call something a habit.
    const repeating = Array.from({ length: 8 }, (_, week) =>
      task({
        title: 'Revision',
        status: 'done',
        completed_at: `2026-0${week < 4 ? 6 : 7}-${String(1 + (week % 4) * 7).padStart(2, '0')}T18:00:00`,
      }),
    );
    const habits = buildHabits(repeating, nameOf, '2026-06-01', '2026-07-31');
    expect(habits.length).toBeGreaterThan(0); // the fixture is doing its job

    draw(
      <HabitsTab
        model={fakeModel({
          historyDays: NEED_DAYS.habits,
          habits,
          summary: habitSummary(habits, []),
        })}
        subjects={subjects}
      />,
    );
    expect(screen.queryByText(/Nothing repeats often enough yet/i)).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Your habits/i })).toBeInTheDocument();
  });
});

describe('Insights', () => {
  it('is locked one day short', () => {
    draw(<InsightsTab model={fakeModel({ historyDays: NEED_DAYS.insights - 1 })} />);
    expect(screen.getByText(/two comparable stretches/i)).toBeInTheDocument();
  });

  it('opens on the day it unlocks — record alone, no second condition', () => {
    // Unlike Habits. An explanation of a quiet fortnight is still an
    // explanation, so there is nothing else to wait for.
    draw(<InsightsTab model={fakeModel({ historyDays: NEED_DAYS.insights })} />);
    expect(screen.queryByText(/two comparable stretches/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /What is true now/i })).toBeInTheDocument();
  });
});

describe('Recommendations', () => {
  it('is locked one day short', () => {
    draw(<RecommendationsTab model={fakeModel({ historyDays: NEED_DAYS.recommendations - 1 })} data={fakeData()} />);
    expect(screen.getByText(/an average needs a fortnight/i)).toBeInTheDocument();
  });

  it('is still locked with enough record and nothing to say', () => {
    draw(<RecommendationsTab model={fakeModel({ historyDays: 400, advice: [] })} data={fakeData()} />);
    expect(screen.getByText(/Nothing to fix/i)).toBeInTheDocument();
  });

  it('shows the plan even while locked — it is gated on nothing', () => {
    // An account three days old still has overdue work and a deadline, and
    // those are the days when being told what to do is worth most.
    draw(<RecommendationsTab model={fakeModel({ historyDays: 1 })} data={fakeData()} />);
    expect(screen.getByText(/an average needs a fortnight/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /next/i })).toBeInTheDocument();
  });

  it('shows the follow-up even while locked — a different question', () => {
    // An account that adopted a change and then went quiet has nothing to
    // recommend and a result waiting. Hiding it behind the same gate would lose
    // the one thing this tab promised to come back and tell you.
    //
    // Built through the real `reviewAdopted`, so the fixture is an adoption
    // this account actually made rather than a hand-shaped Review.
    const reviews = reviewAdopted({
      adopted: [{ id: 'a1', title: 'Claim one weekend day', on: '2026-06-01' }],
      days: days('2026-05-01', 120),
      tasks: [],
      graded: {},
    });
    expect(reviews).toHaveLength(1); // the fixture is doing its job

    draw(
      <RecommendationsTab
        model={fakeModel({ historyDays: 1, reviews, reviewSummary: summarise(reviews) })}
        data={fakeData()}
      />,
    );
    expect(screen.getByText(/an average needs a fortnight/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /What happened after/i })).toBeInTheDocument();
  });
});

describe('Subjects', () => {
  it('says nothing about goals when no subject was worked', () => {
    draw(<SubjectsTab model={fakeModel({ namedSubjects: { total: 0, named: 0 } })} subjects={subjects} />);
    expect(screen.queryByText(/has a goal aimed at it/i)).not.toBeInTheDocument();
  });

  it('names the gap when subjects were worked and none has a goal', () => {
    draw(<SubjectsTab model={fakeModel({ namedSubjects: { total: 3, named: 0 } })} subjects={subjects} />);
    expect(screen.getByText(/None of the/i)).toBeInTheDocument();
  });

  it('counts the ones that do', () => {
    draw(<SubjectsTab model={fakeModel({ namedSubjects: { total: 3, named: 2 } })} subjects={subjects} />);
    expect(screen.getByText(/have a goal/i)).toBeInTheDocument();
  });
});
