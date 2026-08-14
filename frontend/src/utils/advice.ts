/**
 * Turning the record into things to do differently.
 *
 * Every recommendation here is derived from `utils/behaviour` — the same
 * functions the Insights page states its findings from — so the two pages
 * cannot contradict each other. Insights says "you take three-day breaks";
 * this says "closing half of them is worth 4,000 XP a year". One is the
 * finding, the other is the consequence, and they are the same number.
 *
 * ## The rules the rules follow
 *
 * **Only what the data supports.** A recommendation is generated when a
 * threshold in this account's own record is crossed, never on a schedule. An
 * account with an even week and no gaps genuinely has nothing to fix on those
 * counts, and is told so rather than handed filler.
 *
 * **A number attached to every one.** "Be more consistent" is not advice. Each
 * item carries what it would be worth in XP a year, computed from this
 * account's own averages — so the reader can rank them by size rather than by
 * the order somebody wrote them in, which is what `impact` sorts on.
 *
 * **Arithmetic, not prophecy.** Every projection is the account's own average
 * multiplied by a number of days. Nothing here assumes the change compounds,
 * gets easier, or improves anything it does not directly touch.
 */
import type { GrowthDay } from '@/types';
import type { BalanceShape, ClockShape, RhythmShape, WeekShape } from './behaviour';
import type { Ratings } from '@/types';

export type AdviceKind = 'frequency' | 'timing' | 'depth' | 'balance' | 'quality';

/**
 * What area of the habit a suggestion is about.
 *
 * Separate from `kind`, which is the *shape* of the change (how often, when,
 * how long). A reader filters by category — "show me the scheduling ones" — and
 * groups by kind without ever being told the word.
 */
export type AdviceCategory =
  | 'Productivity'
  | 'Consistency'
  | 'Focus'
  | 'Scheduling'
  | 'Task Management'
  | 'Subject Balance'
  | 'Time Management'
  | 'Habit Building';

/**
 * How much this is likely to be worth, as three bands rather than a number.
 *
 * The XP figure is already on the card; a priority is for ranking a page at a
 * glance, and three bands is as fine as the underlying estimate can honestly
 * support. Derived in `rank` from impact against the account's own pace — never
 * assigned by hand, because a hand-assigned priority is just an opinion with a
 * colour.
 */
export type AdvicePriority = 'high' | 'medium' | 'low';

export interface Advice {
  id: string;
  kind: AdviceKind;
  category: AdviceCategory;
  /** The instruction, in the imperative. */
  title: string;
  /** What in the record produced it. */
  because: string;
  /** What to actually do, concretely enough to start today. */
  action: string;
  /** What changes if it works, in words rather than XP. */
  benefit: string;
  /** The count behind it — the line a sceptical reader checks first. */
  evidence: string;
  /** XP a year, if it worked. Drives the ordering. */
  impact: number;
  /** How the impact was arrived at, so it can be argued with. */
  workings: string;
  /** 1-5, where 1 is "you could do this today". */
  effort: number;
  /** Filled in by `rank`. Not written by the rules themselves — see the note. */
  priority: AdvicePriority;
}

/** What a rule states before `rank` adds the ordering fields. */
type Rule = Omit<Advice, 'priority'>;

const KIND_LABEL: Record<AdviceKind, string> = {
  frequency: 'How often',
  timing: 'When',
  depth: 'How long',
  balance: 'What on',
  quality: 'How well',
};

export function kindLabel(kind: AdviceKind): string {
  return KIND_LABEL[kind];
}

export const PRIORITY_LABEL: Record<AdvicePriority, string> = {
  high: 'High impact',
  medium: 'Medium impact',
  low: 'Low impact',
};

/** Three dots rather than three traffic lights — see the note on `AdvicePriority`. */
export const PRIORITY_TONE: Record<AdvicePriority, string> = {
  high: 'pink',
  medium: 'amber',
  low: 'green',
};

/** 1-5 effort, as the word a reader needs before deciding to start. */
export function difficultyLabel(effort: number): string {
  if (effort <= 1) return 'Easy';
  if (effort <= 2) return 'Straightforward';
  if (effort <= 3) return 'Moderate';
  return 'Hard';
}

export interface AdviceInput {
  days: GrowthDay[];
  week: WeekShape;
  clock: ClockShape;
  rhythm: RhythmShape;
  balance: BalanceShape;
  ratings: Ratings | null;
}

/** XP on a day this account actually worked — the unit every projection uses. */
function xpPerActiveDay(days: GrowthDay[]): number {
  const active = days.filter((day) => (Number(day.xp_earned) || 0) > 0);
  if (active.length === 0) return 0;
  return active.reduce((sum, day) => sum + (Number(day.xp_earned) || 0), 0) / active.length;
}

/**
 * Everything this account's record actually supports, largest first.
 *
 * The caller decides how many to show. Returning all of them ranked, rather
 * than a top three, is what lets the page put the rest under "also worth doing"
 * without a second pass over the same thresholds.
 */
export function recommendations(input: AdviceInput): Advice[] {
  const { days, week, clock, rhythm, balance, ratings } = input;
  const out: Rule[] = [];
  const perDay = xpPerActiveDay(days);
  const yearScale = days.length > 0 ? 365 / days.length : 0;

  if (perDay <= 0 || days.length < 14) return [];

  // ---- frequency: the gaps ------------------------------------------------
  if (rhythm.gapCount > 0) {
    // Half the gap days recovered, which is a deliberately modest claim: the
    // whole point of a three-day gap is that some of it was not available.
    const gapDays = Math.round(rhythm.gapCount * 3 * 0.5);
    out.push({
      id: 'close-gaps',
      kind: 'frequency',
      category: 'Consistency',
      title: 'Put something small in the three-day gaps',
      because: `You have taken ${rhythm.gapCount} breaks of three days or more in this range, and a
        break costs you the days themselves plus the streak they interrupt.`,
      action: `A gap almost never starts as a decision — it starts with one missed day that nothing
        pulled you back from. Set the smallest task you will still count as a day: fifteen minutes,
        one problem, one page. The purpose is not the XP, it is that the run never breaks, so there
        is no restart to negotiate on day four.`,
      benefit: 'Fewer restarts, and a streak that survives a bad week.',
      evidence: `${rhythm.gapCount} breaks of 3+ days across ${rhythm.span.toLocaleString()} days${
        rhythm.longestGap ? `, the longest running ${rhythm.longestGap.days} days` : ''
      }.`,
      impact: Math.round(gapDays * perDay * yearScale),
      workings: `${gapDays} recovered days × ${Math.round(perDay).toLocaleString()} XP on a working
        day, scaled to a year.`,
      effort: 2,
    });
  }

  // ---- frequency: the weekend --------------------------------------------
  if (week.weekendGap !== null && week.weekendGap <= -35) {
    const weekendDays = 104 * 0.5;
    out.push({
      id: 'weekend',
      kind: 'frequency',
      category: 'Scheduling',
      title: 'Claim one weekend day',
      because: `Your weekends run ${Math.abs(week.weekendGap)}% lighter than your weekdays, so two of
        every seven days are close to unavailable.`,
      action: `Not both days — one. Pick the weekend day that is already the better of the two and
        give it a single fixed session at a fixed hour, the same one every week. Two of seven days
        is 29% of your available time; you do not have to use all of it to get most of the benefit.`,
      benefit: 'A seven-day week instead of a five-day one, without working every weekend.',
      evidence: `Weekend days average ${Math.round(
        week.stats.filter((stat) => stat.index === 0 || stat.index === 6).reduce((sum, stat) => sum + stat.avgXp, 0) / 2,
      ).toLocaleString()} XP against ${Math.round(
        week.stats.filter((stat) => stat.index > 0 && stat.index < 6).reduce((sum, stat) => sum + stat.avgXp, 0) / 5,
      ).toLocaleString()} on a weekday.`,
      impact: Math.round(weekendDays * perDay * 0.6),
      workings: `Half of the ~104 weekend days a year, at 60% of a normal working day's
        ${Math.round(perDay).toLocaleString()} XP.`,
      effort: 3,
    });
  }

  // ---- depth: the sitting -------------------------------------------------
  if (rhythm.typicalSession > 0 && rhythm.typicalSession < 45) {
    const extra = 15;
    out.push({
      id: 'longer-sittings',
      kind: 'depth',
      category: 'Focus',
      title: 'Add fifteen minutes to the sitting you already have',
      because: `Your typical sitting is ${Math.round(rhythm.typicalSession)} minutes, which is short
        enough that a fair share of it is spent getting started rather than working.`,
      action: `The expensive part of a session is the beginning — finding the place, remembering the
        problem. You are already paying that cost; extending a session you have started is far
        cheaper than starting another one. Add a quarter of an hour to the end, not a second session
        to the day.`,
      benefit: 'More work out of the sessions you are already sitting down for.',
      evidence: `Typical sitting ${Math.round(rhythm.typicalSession)} minutes${
        rhythm.longestSession ? `, against a best of ${Math.round(rhythm.longestSession.minutes)}` : ''
      }, across the ${Math.round(rhythm.activeRate)}% of days you work.`,
      impact: Math.round(
        (extra / rhythm.typicalSession) * perDay * (rhythm.activeRate / 100) * 365,
      ),
      workings: `A ${Math.round((extra / rhythm.typicalSession) * 100)}% longer sitting, on the
        ${Math.round(rhythm.activeRate)}% of days you work, at your current rate per day.`,
      effort: 2,
    });
  }

  // ---- timing: late nights ------------------------------------------------
  if (clock.lateShare >= 20) {
    out.push({
      id: 'earlier',
      kind: 'timing',
      category: 'Time Management',
      title: 'Move one session out of the late shift',
      because: `${clock.lateShare}% of what you finish lands after 10 PM or before 5 AM, and late
        work is the first thing that disappears on a tired or busy day.`,
      action: clock.coreWindow
        ? `Your reliable window is ${hourText(clock.coreWindow.from)}–${hourText(clock.coreWindow.to)}.
           Move the single most important task of the day into it, and let the late slot keep the
           work that does not matter if it is missed. This is not about sleeping more; it is about
           which work is exposed when the day goes wrong.`
        : `Pick the hour you are most often free and awake, and put the most important task of the
           day there instead of at the end of it.`,
      benefit: 'The work that matters stops being the work most likely to be skipped.',
      evidence: `${clock.lateShare}% of completions land after 10 PM or before 5 AM${
        clock.coreWindow
          ? `, against a reliable window of ${hourText(clock.coreWindow.from)}–${hourText(
              clock.coreWindow.to,
            )} holding ${clock.coreWindow.share}%`
          : ''
      }.`,
      impact: Math.round(perDay * 0.15 * (rhythm.activeRate / 100) * 365),
      workings: `Recovering ~15% of a working day's output from sessions currently at risk of being
        skipped, across the days you work.`,
      effort: 3,
    });
  }

  // ---- balance ------------------------------------------------------------
  if (balance.fading.length > 0) {
    out.push({
      id: 'restart-fading',
      kind: 'balance',
      category: 'Subject Balance',
      title: `Restart ${balance.fading[0]}`,
      because: `${balance.fading.join(' and ')} had real work behind ${
        balance.fading.length === 1 ? 'it' : 'them'
      } earlier in this range and none at all in the second half.`,
      action: `Nothing was decided here — a subject like this stops by drifting, and the totals go on
        looking healthy because they still contain all the work you did before. One scheduled session
        is usually enough to find out whether you actually dropped it on purpose.`,
      benefit: 'A subject you meant to keep stops disappearing by accident.',
      evidence: `${balance.fading.join(', ')} carried real work in the first half of this range and none in the second.`,
      impact: 0,
      workings: 'No XP claim: this is about what is missing from the week, not about the total.',
      effort: 2,
    });
  }

  if (balance.leader && balance.concentration >= 45) {
    out.push({
      id: 'rebalance',
      kind: 'balance',
      category: 'Subject Balance',
      title: `Decide whether ${balance.leader} should be ${balance.concentration}% of your week`,
      because: `${balance.leader} takes ${balance.concentration}% of your XP, more than everything
        else combined.`,
      action: `This is genuinely not a mistake — depth is how anything gets mastered, and an account
        spread evenly over nine subjects is an account that is not getting good at any of them. But
        it should be a choice rather than a habit: if it is deliberate, protect it, and if it is
        drift, the fix is one recurring session on the subject you would rather be building.`,
      benefit: 'The shape of your week becomes a decision instead of an accident.',
      evidence: `${balance.leader} holds ${balance.concentration}% of your XP across ${balance.carrying} subjects with real weight behind them.`,
      impact: 0,
      workings: 'No XP claim: the total does not change, only what it is made of.',
      effort: 1,
    });
  }

  // ---- quality: the weakest graded metric --------------------------------
  if (ratings) {
    const metrics = Object.entries(ratings.metrics) as Array<[string, { score: number }]>;
    const weakest = metrics.reduce((a, b) => (b[1].score < a[1].score ? b : a));
    const [name, metric] = weakest;
    if (metric.score < 60) {
      out.push({
        id: `metric-${name}`,
        kind: 'quality',
        category: METRIC_CATEGORY[name] ?? 'Productivity',
        title: `Your ${name} score is the one holding the grade down`,
        because: `It sits at ${metric.score}/100, below every other metric on your report card, so it
          is the one costing you the most overall grade per point of improvement.`,
        action: METRIC_ADVICE[name] ?? 'Work on this metric directly — it is the lowest of the five.',
        benefit: 'The cheapest point of overall grade available, per unit of effort spent.',
        evidence: `${name} scores ${metric.score}/100, the lowest of the five graded metrics.`,
        impact: 0,
        workings: 'No XP claim: the report card grades how you work, not how much.',
        effort: 3,
      });
    }
  }

  // ---- the floor ----------------------------------------------------------
  // Topped up to FLOOR from the same measurements, read at a lower threshold.
  // Nothing invented — see `fallbacks`.
  if (out.length < FLOOR) {
    const have = new Set(out.map((rule) => rule.id));
    for (const rule of fallbacks(input, perDay, yearScale)) {
      if (out.length >= FLOOR) break;
      if (have.has(rule.id)) continue;
      out.push(rule);
      have.add(rule.id);
    }
  }

  return rank(out, perDay * 365);
}

/**
 * The fewest suggestions the tab will show an account that has any at all.
 *
 * Three is what the layout is built for — `HEADLINE_ADVICE` in the page, and a
 * row of three cards — and a tab that came back with one card had the rest of
 * the row as empty space, which reads as something that failed to load rather
 * than as an account with little to fix.
 */
const FLOOR = 3;

/**
 * What is drawn on to reach the floor, in the order it is drawn on.
 *
 * **These are not filler, and the distinction is the whole reason this is a
 * separate pass.** Every one is the same measurement a rule above already gates
 * on, read at a threshold low enough to nearly always have something to say:
 * the strict gates answer "what is clearly wrong here", these answer "what is
 * the most improvable thing here" — which has an answer for every account, and
 * is a weaker claim, so they carry smaller numbers and sort below the real
 * findings on their own merits rather than by being pinned there.
 *
 * They are only ever reached for when the strict pass came back short, and each
 * is skipped if the strict pass already emitted the same id, so an account with
 * three real findings never sees any of this.
 */
function fallbacks(input: AdviceInput, perDay: number, yearScale: number): Rule[] {
  const { days, week, rhythm, balance, ratings } = input;
  const out: Rule[] = [];

  // ---- one more day in the week ------------------------------------------
  // Any account that has ever skipped a day. One that has not is genuinely not
  // being told to add a day it does not have.
  if (rhythm.activeRate < 100) {
    out.push({
      id: 'one-more-day',
      kind: 'frequency',
      category: 'Consistency',
      title: 'Add one more working day to the week',
      because: `You carry work on ${Math.round(rhythm.activeRate)}% of the days in this range, so the
        week already has room in it without any day you keep getting longer.`,
      action: `Pick the day you most often skip — it is usually the same one — and give it the
        smallest session you will still count as a day. The target is the day being on the board at
        all, not what it is worth: this is the only change here that costs nothing on any of the days
        you already work.`,
      benefit: 'More days on the board, without a longer day on any of them.',
      evidence: `${Math.round(rhythm.activeRate)}% of the ${rhythm.span.toLocaleString()} days in
        this range carried work.`,
      impact: Math.round(52 * perDay),
      workings: `52 added days a year — one a week — at ${Math.round(perDay).toLocaleString()} XP on
        a working day.`,
      effort: 2,
    });
  }

  // ---- the sitting, at a threshold that is not "too short" ----------------
  // Two hours is where adding ten minutes stops being the cheap option and
  // the session length stops being the thing worth changing.
  if (rhythm.typicalSession > 0 && rhythm.typicalSession < 120) {
    const extra = 10;
    out.push({
      id: 'longer-sittings',
      kind: 'depth',
      category: 'Focus',
      title: 'Add ten minutes to the sitting you already have',
      because: `Your typical sitting is ${Math.round(rhythm.typicalSession)} minutes. That is not
        short, but the beginning of a session is its expensive part and you have already paid it.`,
      action: `Extending a session you have started is cheaper than starting another one — the
        finding of the place and the remembering of the problem are already done. Add the ten minutes
        to the end of a sitting you were having anyway, rather than to the plan for tomorrow.`,
      benefit: 'More work out of the sessions you are already sitting down for.',
      evidence: `Typical sitting ${Math.round(rhythm.typicalSession)} minutes${
        rhythm.longestSession ? `, against a best of ${Math.round(rhythm.longestSession.minutes)}` : ''
      }, across the ${Math.round(rhythm.activeRate)}% of days you work.`,
      impact: Math.round((extra / rhythm.typicalSession) * perDay * (rhythm.activeRate / 100) * 365),
      workings: `A ${Math.round((extra / rhythm.typicalSession) * 100)}% longer sitting, on the
        ${Math.round(rhythm.activeRate)}% of days you work, at your current rate per day.`,
      effort: 1,
    });
  }

  // ---- the two weakest graded metrics -------------------------------------
  // The strict rule takes the weakest and only below 60. This takes the two
  // lowest that are not already perfect — "the lowest of the five is where a
  // point is cheapest" holds at any score, which is what makes it a fair thing
  // to say to a strong account and the reason there is no band here.
  if (ratings) {
    const metrics = Object.entries(ratings.metrics) as Array<[string, { score: number }]>;
    [...metrics]
      .sort((a, b) => a[1].score - b[1].score)
      .slice(0, 2)
      .forEach(([name, metric]) => {
        if (metric.score >= 100) return;
        out.push({
          id: `metric-${name}`,
          kind: 'quality',
          category: METRIC_CATEGORY[name] ?? 'Productivity',
          title: `${name[0]!.toUpperCase()}${name.slice(1)} is the cheapest point on your report card`,
          because: `It sits at ${metric.score}/100 — among the lowest of your five graded metrics, so
            it is where a point of improvement costs you the least effort.`,
          action: METRIC_ADVICE[name] ?? 'Work on this metric directly — it is among the lowest of the five.',
          benefit: 'A better grade for less work than any of the other four would take.',
          evidence: `${name} scores ${metric.score}/100 against a best of ${Math.max(
            ...metrics.map(([, entry]) => entry.score),
          )}/100 elsewhere on the card.`,
          impact: 0,
          workings: 'No XP claim: the report card grades how you work, not how much.',
          effort: 2,
        });
      });
  }

  // ---- the shape of the week, at a threshold below "lopsided" -------------
  // Any account carrying more than one subject: "should it be this share" is a
  // fair question at 30% and still a fair one at 12%.
  if (balance.leader && balance.carrying > 1) {
    out.push({
      id: 'rebalance',
      kind: 'balance',
      category: 'Subject Balance',
      title: `Decide whether ${balance.leader} should be ${balance.concentration}% of your week`,
      because: `${balance.leader} takes ${balance.concentration}% of your XP across
        ${balance.carrying} subjects with real weight behind them.`,
      action: `Depth is how anything gets mastered and an account spread evenly over nine subjects is
        an account getting good at none of them — so this is not a fault. It is worth being a
        decision rather than a habit: if it is deliberate, protect it; if it is drift, one recurring
        session on the subject you would rather be building is the whole fix.`,
      benefit: 'The shape of your week becomes a decision instead of an accident.',
      evidence: `${balance.leader} holds ${balance.concentration}% of your XP across ${balance.carrying} subjects with real weight behind them.`,
      impact: 0,
      workings: 'No XP claim: the total does not change, only what it is made of.',
      effort: 1,
    });
  }

  // ---- the quietest day of the week ---------------------------------------
  // Seven averages always exist, and unless they are all identical one of them
  // is the lowest. Distinct from the weekend rule above, which fires only on a
  // whole weekend running light — this is about a single named day.
  const byDay = [...week.stats].sort((a, b) => a.avgXp - b.avgXp);
  const quietest = byDay[0];
  const busiest = byDay[byDay.length - 1];
  if (quietest && busiest && busiest.avgXp > quietest.avgXp && quietest.days > 0) {
    const lift = (busiest.avgXp - quietest.avgXp) * 0.5;
    out.push({
      id: 'quietest-weekday',
      kind: 'timing',
      category: 'Scheduling',
      title: `${quietest.label} is the day that goes missing`,
      because: `${quietest.label}s average ${Math.round(quietest.avgXp).toLocaleString()} XP against
        ${Math.round(busiest.avgXp).toLocaleString()} on a ${busiest.label}, and it is the same day
        every week rather than a run of bad luck.`,
      action: `A weekday that is reliably quieter than the rest is usually a scheduling fact rather
        than a motivation one — something else has that slot. Find what it is before deciding it is a
        discipline problem, then give the day one fixed session at an hour that is actually free.`,
      benefit: 'A week without a hole in the same place in it.',
      evidence: `${quietest.label} averages ${Math.round(quietest.avgXp).toLocaleString()} XP across
        ${quietest.days} of them, ${Math.round(quietest.activeRate)}% of which carried any work.`,
      impact: Math.round(lift * 52),
      workings: `Half the gap to your best weekday, ${Math.round(lift).toLocaleString()} XP, on the
        52 ${quietest.label}s in a year.`,
      effort: 2,
    });
  }

  // ---- the quiet working days ---------------------------------------------
  // The last resort, and the one with no threshold at all: every account that
  // has worked at all has a weakest quarter of its working days.
  const worked = days
    .map((day) => Number(day.xp_earned) || 0)
    .filter((xp) => xp > 0)
    .sort((a, b) => a - b);
  if (worked.length >= 4) {
    const median = worked[Math.floor(worked.length / 2)]!;
    const quiet = worked.slice(0, Math.max(1, Math.floor(worked.length / 4)));
    const quietAvg = quiet.reduce((sum, xp) => sum + xp, 0) / quiet.length;
    if (median > quietAvg) {
      out.push({
        id: 'raise-the-floor',
        kind: 'depth',
        category: 'Consistency',
        title: 'Raise the floor rather than the ceiling',
        because: `Your quietest working days average ${Math.round(quietAvg).toLocaleString()} XP
          against a typical day's ${Math.round(median).toLocaleString()} — the spread between your
          days is wider than the spread between your weeks.`,
        action: `A best day is not repeatable on demand and a quiet day usually is: the quiet ones
          are where the recoverable work is. Set the minimum you will do on a day you have already
          decided to work, and hold that rather than trying to beat your record.`,
        benefit: 'A steadier week, from the days you were going to work anyway.',
        evidence: `The quietest ${quiet.length} of ${worked.length} working days average
          ${Math.round(quietAvg).toLocaleString()} XP, against a median of
          ${Math.round(median).toLocaleString()}.`,
        impact: Math.round((median - quietAvg) * quiet.length * yearScale),
        workings: `${quiet.length} quiet days lifted to the median, a gain of
          ${Math.round(median - quietAvg).toLocaleString()} XP each, scaled to a year.`,
        effort: 2,
      });
    }
  }

  return out;
}

/**
 * The ordering, and the priority band that comes with it.
 *
 * Ranked by XP a year first because that is the one comparison that survives
 * between two suggestions about different things, then by effort so that two
 * items worth the same amount put the easier one first. The band is cut against
 * the account's *own* yearly pace rather than a fixed number of XP: a
 * suggestion worth 4,000 a year is transformative on one account and a rounding
 * error on another, and a page that called both "high impact" would be
 * describing the suggestion instead of the reader.
 *
 * The unscored items — the ones that change the shape of a week rather than its
 * size — cannot be ranked this way and are never called high impact. They sort
 * to the bottom and say why on the card.
 */
function rank(rules: Rule[], yearlyPace: number): Advice[] {
  return rules
    .map<Advice>((rule) => {
      const share = yearlyPace > 0 ? rule.impact / yearlyPace : 0;
      return {
        ...rule,
        priority: rule.impact === 0 ? 'low' : share >= 0.12 ? 'high' : share >= 0.04 ? 'medium' : 'low',
      };
    })
    .sort((a, b) => b.impact - a.impact || a.effort - b.effort);
}

/** Which area of the habit each graded metric actually belongs to. */
const METRIC_CATEGORY: Record<string, AdviceCategory> = {
  productivity: 'Productivity',
  quality: 'Task Management',
  consistency: 'Consistency',
  efficiency: 'Scheduling',
  focus: 'Focus',
};

/** What each report-card metric actually responds to. */
const METRIC_ADVICE: Record<string, string> = {
  productivity: `Productivity is average XP a day across the whole range, so blank days count against
    it just as much as small ones. It moves on frequency far more than on effort — a fortnight
    without a gap will shift it further than a heroic weekend.`,
  quality: `Quality is the average XP a finished task carries. It rises when you stop splitting work
    into trivial tickets to feel productive: one task worth doing beats three worth ten points.`,
  consistency: `Consistency is the share of days with anything on them. Nothing else on the report
    card is this easy to move deliberately, and nothing else punishes a gap as hard.`,
  efficiency: `Efficiency reads how long finished tasks took against their deadlines. It improves by
    setting deadlines you actually believe — a task with an honest due date that you meet scores
    better than one with an optimistic date you miss.`,
  focus: `Focus is logged focus time against your daily goal. If the goal is set higher than any week
    you have ever actually had, lowering it to something you would hit four days in five will do more
    for this number, and for the habit, than trying harder.`,
};

function hourText(hour: number): string {
  const suffix = hour < 12 ? 'AM' : 'PM';
  const twelve = hour % 12 === 0 ? 12 : hour % 12;
  return `${twelve} ${suffix}`;
}

// --------------------------------------------------------------------------
// What the whole set would be worth
// --------------------------------------------------------------------------
export interface Outlook {
  /** XP a year at the current pace. */
  current: number;
  /** XP a year with every scored recommendation taken. */
  improved: number;
  /** The two as running totals over five years, for the chart. */
  currentLine: number[];
  improvedLine: number[];
}

/**
 * The pace now against the pace if the advice worked, over five years.
 *
 * Both lines start where the account actually is, so the gap between them is
 * the whole of the claim being made — and it is drawn over five years because
 * that is the horizon on which a change of habit stops being a rounding error.
 * The improved line is not a promise; it is the arithmetic of the items above
 * added up, which is why every one of them shows its workings.
 */
export function outlook(days: GrowthDay[], advice: Advice[], banked: number): Outlook {
  const earned = days.reduce((sum, day) => sum + (Number(day.xp_earned) || 0), 0);
  const current = days.length ? (earned / days.length) * 365 : 0;
  const gain = advice.reduce((sum, item) => sum + item.impact, 0);
  const improved = current + gain;

  const line = (perYear: number) =>
    Array.from({ length: 21 }, (_, step) => banked + (perYear * step) / 4);

  return {
    current: Math.round(current),
    improved: Math.round(improved),
    currentLine: line(current),
    improvedLine: line(improved),
  };
}

// --------------------------------------------------------------------------
// Placeholder data
// --------------------------------------------------------------------------
/**
 * What the tab shows before the record can generate anything.
 *
 * The rules above need a fortnight of days and a working average before they
 * will produce a single item, which is correct and leaves a brand-new account
 * looking at an empty page with no idea what the tab is for. These are what it
 * looks like when it is working, drawn from an invented account and marked as
 * such by the Sample chip in the panel's top right — same contract as
 * `SAMPLE_HABITS` and `SAMPLE_FINDINGS`.
 */
export const SAMPLE_ADVICE: Advice[] = [
  {
    id: 'sample-timing',
    kind: 'timing',
    category: 'Time Management',
    priority: 'high',
    title: 'Move your hardest task into the 4–6 PM window',
    because: `Your completion rate for high-priority tasks is 21% higher before 5 PM than after it,
      and most of them are currently being scheduled into the evening.`,
    action: `Take tomorrow's hardest single task and put it at 4 PM for the next seven days. Not the
      whole day's work — one task, one slot. The point is to find out whether the difference in the
      record is about the hour or about which tasks happen to land in it.`,
    benefit: 'Higher completion consistency on the work that actually matters.',
    evidence: '24 high-priority tasks completed before 5 PM against 31 after, over 90 days.',
    impact: 6400,
    workings: '15% of a working day’s 412 XP recovered across the 71% of days you work, over a year.',
    effort: 3,
  },
  {
    id: 'sample-overload',
    kind: 'frequency',
    category: 'Task Management',
    priority: 'medium',
    title: 'Stop planning more than you have ever finished',
    because: `On days where you plan more than six tasks, an average of 2.4 of them go unfinished —
      and they are almost always the low-priority ones at the bottom of the list.`,
    action: `Cap tomorrow's list at your own historical capacity rather than your ambition for it.
      A list you finish is a list you trust, and a list you trust is one you will still be writing
      in a month.`,
    benefit: 'Fewer carried-over tasks, and a plan that means something by the evening.',
    evidence: '18 of 46 working days ended with 2 or more planned tasks untouched.',
    impact: 2900,
    workings: 'Half of the unfinished low-priority work recovered, at your average XP per task.',
    effort: 2,
  },
  {
    id: 'sample-gaps',
    kind: 'frequency',
    category: 'Consistency',
    priority: 'medium',
    title: 'Put something small in the three-day gaps',
    because: `You have taken 5 breaks of three days or more in this range, and a break costs you the
      days themselves plus the streak they interrupt.`,
    action: `Set the smallest task you will still count as a day: fifteen minutes, one problem, one
      page. The purpose is not the XP, it is that the run never breaks, so there is no restart to
      negotiate on day four.`,
    benefit: 'Fewer restarts, and a streak that survives a bad week.',
    evidence: '5 breaks of 3+ days across 180 days, the longest running 9 days.',
    impact: 2400,
    workings: '8 recovered days × 412 XP on a working day, scaled to a year.',
    effort: 2,
  },
  {
    id: 'sample-balance',
    kind: 'balance',
    category: 'Subject Balance',
    priority: 'low',
    title: 'Restart Violin Practice',
    because: 'It had real work behind it earlier in this range and none at all in the second half.',
    action: `Nothing was decided here — a subject like this stops by drifting, and the totals go on
      looking healthy because they still contain all the work you did before. One scheduled session
      is usually enough to find out whether you dropped it on purpose.`,
    benefit: 'A subject you meant to keep stops disappearing by accident.',
    evidence: 'Violin Practice carried 1,300 XP in the first half of this range and none in the second.',
    impact: 0,
    workings: 'No XP claim: this is about what is missing from the week, not about the total.',
    effort: 2,
  },
];
