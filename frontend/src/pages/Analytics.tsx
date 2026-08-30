/**
 * Analytics — one page, seven tabs, and the first one is the point.
 *
 * This page was the graded report card, then the long view of an account, and
 * it is now the place the app does its thinking. Analysis split across separate
 * pages in the rail was pages nobody moved between, and the value of the
 * analysis is in the movement — what I do, then why, then what to change. One
 * bar makes that sequence a click instead of a navigation.
 *
 * ## The seven tabs
 *
 * - **Recommendations — how I improve.** Instructions, ranked by what each is
 *   worth, with the arithmetic attached. It never re-states a finding as news.
 *   It leads the bar and owns the rail entry, because it is the only tab that
 *   ends in a button and it used to sit five clicks behind four screens of
 *   description.
 * - **Overview** — productivity, consistency and quality, their trajectory, the
 *   score, and where the account stands. The three rates lead every panel on
 *   this tab; the totals they came from sit behind them. See `Tiles` for why.
 * - **Trends** — the derivative rather than the level, plus the long-term
 *   projection that was the growth page's Long Term chapter.
 * - **Habits — what I do.** Recurring behaviour, counted, plus the growth
 *   page's Focus chapter: whether it can be executed reliably. It never says
 *   *why*: the moment it does, the next tab has no reason to exist.
 * - **Insights — why and how.** Two counts put together, with the evidence for
 *   the connection graded and printed. It never says what to do.
 * - **Subjects** — mastery. The growth page's Subject chapter.
 * - **Records** — achievement, against the reader's own best and their goals.
 *
 * Keeping the middle boundaries sharp is the design decision this page is built
 * around: three tabs that all show cards of numbers are one tab with a broken
 * picker.
 *
 * ## How it holds together
 *
 * **Five calls, one window, seven tabs.** The whole day series (`days: 0`), the
 * account's stats and tasks, the report card, where this account stands against
 * the others, and the baseline. Every panel is arithmetic over the first three
 * — nothing here fetches per tab — and every tab is scoped by the one window
 * picker, so two tabs can never quietly be describing different periods. The
 * exceptions are deliberate: the Overview heatmap always draws a year and the
 * Habits calendar carries its own zoom, because a map of 91 squares and a map
 * of 730 are not the same picture.
 *
 * Standing is the odd call and stays separate: it is the only thing here
 * computed from anybody else's record, so it cannot be arithmetic over the
 * series, and it is unscoped by the window because "where you stand" is a
 * question about the account rather than about a quarter of it.
 *
 * **A tab is a route.** Seven paths render this component and differ only in
 * which view opens. That is what makes the rail, the back button and a pasted
 * link agree about which tab is showing — local state would have broken all
 * three. `/growth` redirects here; see App.tsx.
 *
 * **Everything computes on every render, and that is on purpose.** All of it is
 * memoised against the slice, so switching tabs recomputes nothing; the cost of
 * running the arithmetic for a hidden tab is a few hundred array passes once
 * per window change, and the alternative — children each holding their own
 * memos — would put the arithmetic out of reach of the page that has to decide,
 * before rendering a tab, whether that tab has anything to say.
 *
 * ## Where the page ends and its parts begin
 *
 * This file was 1,879 lines and held the fetching, the arithmetic, the tab
 * bodies and the shell at once, which meant changing one tab's layout required
 * reading all of it. Three seams, in the order a reader meets them:
 *
 * - **`./useAnalyticsData`** — the eight calls and the three writes. How many
 *   requests a visit costs is now a question with a file to open.
 * - **`./useAnalyticsModel`** — every figure the page states. Deliberately one
 *   hook and not seven: the gates and the opening sentence below have to read a
 *   tab's figures *before* deciding whether to render it, and a memo living
 *   inside a tab is a memo the gate cannot see. Two tabs also cannot disagree
 *   about a number that is computed once.
 * - **`./tabs/*`** — seven components that lay out what the model worked out.
 *   They fetch nothing and calculate nothing.
 *
 * What is left here is the shell: the window picker, the gates, the one-sentence
 * opening every tab shares, the baseline screen, and the export.
 *
 * **Every figure on this page is this account's own.** There is no sample data
 * and no placeholder mode. Four tabs used to fall back to invented figures
 * behind a small chip when the record was too short to fill them; that made a
 * new account's first impression of the analysis a page of numbers about
 * somebody who does not exist, and taught the reader to discount the real ones
 * that arrived later. A tab that cannot be filled now says what it is waiting
 * for and when it opens — see `Locked` — and a new account is offered the one
 * thing it can actually do here, which is `BaselineSetup`.
 */
import { useCallback, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Ambient, ErrorState, Loading } from '@/components';
import {
  BaselineSetup,
  Controls,
  GoalsTab,
  habitLead,
  NEED_DAYS,
  HabitsTab,
  Header,
  InsightsTab,
  OverviewTab,
  RecommendationsTab,
  RecordsTab,
  scoreMovement,
  SubjectsTab,
  Summary,
  TabOpening,
  useAnalyticsData,
  useAnalyticsModel,
  ViewTabs,
  viewFor,
  type BaselineValues,
  type View,
} from '@/components/Analytics';
import { useDocumentTitle, useSubjectIndex } from '@/hooks';
import { PATTERN_DAYS, RECENT_DAYS } from '@/utils/recent';
import { buildReport, reportFilename } from '@/utils/report';
import '@/styles/analytics.css';
/**
 * The chapters' own stylesheet, which came with them.
 *
 * Their markup is `gr-*` classes and its rules read a block of tokens that used
 * to be scoped to `#growthCard` — the id on the growth page's outer card. That
 * card is gone, so the token block and the handful of rules that depended on
 * the ancestor now answer to `.gr-scope` as well, and the four chapter tabs
 * render inside one. See the note at `.gr-scope` in the stylesheet.
 */
import '@/styles/growth.css';


export default function Analytics() {
  const location = useLocation();
  const navigate = useNavigate();
  const view = viewFor(location.pathname);

  useDocumentTitle(view.title);

  /**
   * Every call this page makes, and every write it does. See ./useAnalyticsData.
   *
   * One hook rather than eight `useApi`s inline, because how many requests a
   * visit to this page costs is a question worth being able to answer by
   * opening one file. Nothing about the calls changed in moving them.
   */
  const data = useAnalyticsData();
  const { username, series, baseline, refresh } = data;

  /**
   * Every figure the page states. See ./useAnalyticsModel.
   *
   * Centralised rather than pushed into the tabs, and that is the whole design
   * of this page: the gates and the opening sentence below have to read a
   * tab's figures *before* deciding whether to render it, which a memo living
   * inside the tab could not provide. The tabs get the answers as props and do
   * nothing but lay them out.
   */
  const subjects = useSubjectIndex(username);
  const model = useAnalyticsModel(data, subjects);
  /* The page reads a dozen of the model's eighty figures — the gates, the
     opening sentence and the export. Everything else goes to a tab whole. */
  const {
    span, chooseSpan, option, spanText, subject, setSubject, subjectOptions, waitFor,
    historyDays, maturity, streak, analytical, hasReportCard, figures, insights, breakdown, banked, recentSubjects,
    discovered, diagnoses, advice, plan, recorded, state, goalSet, habits, summary,
  } = model;
  // ---- The shell ----------------------------------------------------------

  /**
   * The written report the Export button downloads.
   *
   * A callback rather than a value: building it costs a few milliseconds of
   * string work and there is no reason to pay that on every render of a page
   * whose export most visits never touch. Returns null when there is no report
   * card yet, which is what disables the button — a file full of dashes is
   * worse than no file.
   *
   * Everything below is already derived by the module that owns it. This only
   * gathers, so a figure in the export and the same figure on screen are the
   * same figure by construction rather than by two people remembering to keep
   * them in step.
   */
  const report = useCallback((): string | null => {
    if (!hasReportCard) return null;
    return buildReport({
      username: username ?? 'account',
      generatedAt: new Date(),
      span: spanText,
      adviceDays: RECENT_DAYS,
      patternDays: PATTERN_DAYS,
      score: analytical,
      figures,
      insights,
      streak,
      bankedXp: banked,
      subjectRows: breakdown.rows,
      subjectQuality: recentSubjects.rows,
      patterns: discovered,
      diagnoses,
      advice,
      plan: plan.actions,
      planBudget: plan.budget,
    });
  }, [
    advice,
    analytical,
    banked,
    breakdown.rows,
    diagnoses,
    discovered,
    figures,
    insights,
    plan,
    hasReportCard,
    recentSubjects.rows,
    spanText,
    streak,
    username,
  ]);

  const openView = useCallback((next: View) => navigate(next.path), [navigate]);

  // ---- The baseline -------------------------------------------------------
  /**
   * Whether the setup screen is showing.
   *
   * Three states rather than two, which is why this is not just
   * `baseline.data?.baseline === null`. A first-run account is shown the screen
   * because it has nothing else to do here; an account that skipped is shown
   * the page, because insisting would be a wall rather than an offer; and an
   * account with a baseline can open the screen again from the panel to change
   * it. `null` means "decide from the record", which is the first-run case.
   */
  const [editingBaseline, setEditingBaseline] = useState<boolean | null>(null);
  const aim = baseline.data?.baseline ?? null;

  /* The write lives in ./useAnalyticsData, beside the read it invalidates.
     Closing the screen stays here: `editingBaseline` has three states and two
     of them are nothing to do with a write having landed. */
  const saveBaseline = useCallback(
    async (values: BaselineValues) => {
      const saved = await data.saveBaseline(values);
      if (saved) setEditingBaseline(false);
      return saved;
    },
    [data],
  );


  /**
   * Whether the setup screen takes the page over.
   *
   * Only when there is no baseline *and* the record is too short for the
   * shortest tab to say anything — an established account that never set one
   * gets the offer inside the Overview rather than a screen in front of the
   * analysis it came for. Held until the call answers, so the page does not
   * flash the setup screen at somebody who has a baseline.
   */
  const firstRun =
    !baseline.loading &&
    baseline.data !== null &&
    aim === null &&
    historyDays < NEED_DAYS.recommendations;
  const showSetup = editingBaseline ?? firstRun;

  if (series.loading) return <Loading label="Reading your history" />;
  if (!series.data) {
    return (
      <ErrorState
        message={series.error ?? 'No analytics yet.'}
        onRetry={username ? refresh : undefined}
      />
    );
  }

  /*
   * The tab's opening line — one sentence, one slot, all seven tabs.
   *
   * None of these sentences is written here. Each is assembled somewhere that
   * already knew how, from that tab's own figures, and three of them used to be
   * the lead paragraph of a panel further down their own tab. Those panels gave
   * them up rather than printing them twice.
   *
   * Guarded by the same conditions the tab bodies use, so a tab still waiting
   * for record does not open with a confident sentence sitting above a notice
   * saying it has nothing to say yet.
   */
  const opening = ((): React.ReactNode => {
    switch (view.key) {
      case 'overview':
        /* Nothing until a fortnight of recorded work. `Summary` leads with a
           score out of a hundred and a letter grade, and that is the most
           confident claim the page makes about a person — on day two it is
           arithmetic over an empty record, and on day nine it is a verdict
           passed on somebody the app has barely met.
           
           Suppressed for the same three stages that hold `ScorePanel` and
           `StandingPanel` back on the tab itself, so the grade, its chart and
           its percentile all arrive together rather than one of them turning
           up a week before the other two. The tab's own opening below a
           fortnight is `Collecting` or `StageNote`, which say the true thing
           instead. See utils/dataMaturity. */
        if (maturity.stage === 'new' || maturity.stage === 'early' || maturity.stage === 'weekly') {
          return null;
        }
        /* The one tab whose opening is a block rather than a line. Everything
           it states is already in scope here — which is why it lives in this
           slot rather than inside `OverviewView`, which would need four more
           props to say the same thing. */
        return (
          <Summary
            score={analytical}
            movement={scoreMovement(recorded)}
            topAdvice={advice[0]?.title ?? null}
            adviceCount={advice.length}
            phase={waitFor('insights') === 0 ? state.phase : null}
            /* What it is read from, until "enough" is the honest answer. The
               score is the mean of five measures and it swings a long way on
               one good week at this length — a fact about the number rather
               than a hedge, so it sits beside it. */
            basis={
              maturity.stage === 'full'
                ? null
                : `Read from ${maturity.activeDays} days of your work. It will settle as you record more.`
            }
            goals={
              goalSet.active > 0
                ? { active: goalSet.active, behind: goalSet.atRisk + goalSet.offTrack }
                : null
            }
          />
        );
      case 'goals':
        return goalSet.active > 0 ? (
          <TabOpening tone={goalSet.atRisk + goalSet.offTrack > 0 ? 'down' : 'up'}>
            <strong>{goalSet.active}</strong> {goalSet.active === 1 ? 'goal is' : 'goals are'}{' '}
            live
            {goalSet.atRisk + goalSet.offTrack > 0 ? (
              <>
                , and <strong>{goalSet.atRisk + goalSet.offTrack}</strong> of them{' '}
                {goalSet.atRisk + goalSet.offTrack === 1 ? 'is' : 'are'} behind.
              </>
            ) : (
              <>, and none of them is behind.</>
            )}
          </TabOpening>
        ) : null;
      case 'habits':
        return waitFor('habits') === 0 && habits.length > 0 ? (
          <TabOpening>{habitLead(summary, spanText)}</TabOpening>
        ) : null;
      case 'insights':
        return waitFor('insights') === 0 ? <TabOpening>{state.sentence}</TabOpening> : null;
      case 'recommendations':
        return advice.length > 0 ? (
          <TabOpening>
            {advice.length} {advice.length === 1 ? 'change is' : 'changes are'} worth making here.
            The first is <strong>{advice[0]!.title.toLowerCase()}</strong>.
          </TabOpening>
        ) : null;
      case 'subjects':
        return breakdown.rows.length > 0 ? (
          <TabOpening>
            <strong>{breakdown.rows.length}</strong>{' '}
            {breakdown.rows.length === 1 ? 'subject has' : 'subjects have'} XP in {spanText}, and{' '}
            <strong>{breakdown.rows[0]!.label}</strong> is the furthest along.
          </TabOpening>
        ) : null;
      case 'records':
        return streak > 0 ? (
          <TabOpening tone="up">
            You are <strong>{streak}</strong> {streak === 1 ? 'day' : 'days'} into the current
            streak.
          </TabOpening>
        ) : null;
      default:
        return null;
    }
  })();


  return (
    <div className="ax-page">
      <Ambient />
      {/* No `pg-enter` here, unlike every other page. This one has its own
          arrival and always did — `.ax-panel` and the tiles carry `ax-enter`,
          which is the same fade and the same ten pixels, and the charts inside
          them wipe on after it (styles/analytics.css, "Arriving"). Adding the
          shared cascade on top ran both at once: the panel would reach half
          opacity behind a section at half opacity and travel the distance
          twice. One entrance per page, and this page already had a richer one. */}
      {/* The view rides on the shell so a tab can tune its own rhythm without
          reaching for the other six. Recommendations is the one that needs it:
          it is the only tab whose panels are read rather than scanned, and at
          the shared 18px the plan, the diagnosis and the cards ran together as
          one wall. */}
      <div className={`ax-shell page-shell ax-view-${view.key}`}>
        <Header
          view={view}
          span={spanText}
          onExport={report}
          exportName={reportFilename(username ?? 'account', new Date())}
        />
        <ViewTabs active={view.key} onView={openView} />

        {/* The setup screen replaces the controls as well as the tab, because
            a window picker over a page with nothing in it to scope is a control
            that does nothing — and the one thing this screen is for is being
            the only thing on it. */}
        {showSetup ? (
          <BaselineSetup
            subjects={subjectOptions}
            current={aim}
            setOn={aim?.set_on ?? ''}
            onSave={saveBaseline}
            onSkip={() => setEditingBaseline(false)}
          />
        ) : (
          <>
        <Controls
          chosen={span}
          onWindow={chooseSpan}
          subject={subject}
          onSubject={setSubject}
          subjects={subjectOptions}
          compareLabel={option.compare}
        />

        {/* One sentence, same place, every tab. See `TabOpening`. */}
        {opening}

        {view.key === 'overview' && (
          <OverviewTab model={model} data={data} onEditBaseline={() => setEditingBaseline(true)} />
        )}

        {view.key === 'goals' && <GoalsTab model={model} />}
        {view.key === 'habits' && <HabitsTab model={model} subjects={subjects} />}
        {view.key === 'insights' && <InsightsTab model={model} />}
        {view.key === 'recommendations' && <RecommendationsTab model={model} data={data} />}
        {view.key === 'subjects' && <SubjectsTab model={model} subjects={subjects} />}
        {view.key === 'records' && <RecordsTab model={model} data={data} />}
          </>
        )}
      </div>
    </div>
  );
}
