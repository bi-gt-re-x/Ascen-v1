/**
 * One subject, on its own.
 *
 * ## What this page is for, and why it is not a tab
 *
 * The analytics page has a Subjects tab already, and it answers a different
 * question: it ranks the account's subjects against each other, so a reader
 * can see which of them is getting the work. This page answers the question
 * that ranking cannot — *how is this one going* — with the whole screen given
 * to a single subject rather than a row in a table of them.
 *
 * It is a page rather than an eighth tab because there is one of these per
 * followed subject. Tabs are a fixed set the reader learns; four of them
 * appearing because somebody answered a wizard question would make the tab bar
 * a different shape on every account, and the bar is already at seven. The
 * rail's Analytics entry unfolds into the list instead — Overall, then one row
 * per subject — which is the control that can grow without the page changing
 * shape. See `analytics_subjects` in services/settings.
 *
 * ## Where the numbers come from, and where they do not
 *
 * All of them, from one call: `/api/analytics/tasks`, the same sixteen columns
 * the analytics page reads. Nothing here is fetched per panel and nothing is
 * fetched per subject — the filter is a comparison on `task.subject`, so
 * opening four of these pages costs what opening one does. The arithmetic is
 * in ./components/Subject/model, which is a pure function of the tasks, the
 * window and the day; this file lays out what it worked out.
 *
 * **The sections are the ones that were asked for. The figures are the ones
 * that are true.** A page about Mathematics wants to say "Geometry 68%,
 * Algebra 94%", and Ascen has no evidence for either: tasks carry a subject
 * and nothing finer, and the skill trees that do name sub-skills are authored
 * hierarchies whose states are illustrative. So the sub-skill breakdown is the
 * *difficulty bands*, which are recorded on every rated task, and the mistake
 * analysis is the *twelve reasons*, which exist as a closed vocabulary
 * precisely so they can be counted. The model's own note has the full mapping.
 * Nothing on this page is a placeholder, and nothing is invented — which is
 * the rule the analytics page states about itself and the reason its figures
 * are worth reading at all.
 *
 * ## A panel that has nothing to say does not draw
 *
 * Every section below is gated on its own evidence rather than on the page
 * having loaded. A subject with no rated tasks has no quality figure, no
 * bands and no reasons, and the honest page for it is a short one that says
 * what it is waiting for — not eight panels of dashes.
 */
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Ambient, ErrorState, Loading } from '@/components';
import { WINDOWS, type WindowKey } from '@/components/Analytics/data';
import { subjectModel } from '@/components/Subject/model';
import { useApi, useAuth, useDocumentTitle, useSettings, useSubjectIndex } from '@/hooks';
import { analyticsTasks } from '@/services/analytics';
import { format } from '@/utils';
import '@/styles/analytics.css';
import '@/styles/subject.css';

/** Today, as the ISO day every window here is measured back from. */
function todayIso(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

/** A signed percentage, with the arrow the spec's own tables use. */
function Delta({ value, unit = '%' }: { value: number | null; unit?: string }) {
  if (value === null) return <span className="sb-delta is-flat">—</span>;
  if (value === 0) return <span className="sb-delta is-flat">→ no change</span>;
  return (
    <span className={`sb-delta ${value > 0 ? 'is-up' : 'is-down'}`}>
      {value > 0 ? '↑' : '↓'} {Math.abs(value)}
      {unit}
    </span>
  );
}

/** A 0-100 bar. Labelled by its row, so it is decoration and hidden. */
function Bar({ percent }: { percent: number }) {
  return (
    <span className="sb-bar" aria-hidden="true">
      <span className="sb-bar-fill" style={{ width: `${Math.max(0, Math.min(100, percent))}%` }} />
    </span>
  );
}

function Panel({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="ax-panel sb-panel">
      <div className="ax-panel-head">
        <div className="ax-panel-title">
          <h2>{title}</h2>
        </div>
      </div>
      {note && <p className="ax-panel-note">{note}</p>}
      {children}
    </section>
  );
}

export default function SubjectAnalytics() {
  const { subjectId = '' } = useParams();
  const { username } = useAuth();
  const { prefs } = useSettings();
  const catalogue = useSubjectIndex(username);
  const subject = catalogue.get(subjectId);

  /* The window opens on the account's own analytics preference, so this page
     and the analytics page agree about what "recently" means on arrival. It is
     local state after that: the two pages are read in sequence and a picker
     that wrote back would change the other page under the reader. */
  const [span, setSpan] = useState<WindowKey>(prefs.analytics_window);

  const call = useMemo(
    () =>
      username
        ? analyticsTasks
        : () => Promise.resolve({ success: false as const, message: 'Sign in to see a subject.' }),
    [username],
  );
  const tasks = useApi(call, [username]);

  const today = todayIso();
  const model = useMemo(
    () => subjectModel(tasks.data?.tasks ?? [], subjectId, span, today),
    [span, subjectId, tasks.data, today],
  );

  useDocumentTitle(subject ? subject.name : 'Subject');

  /* The catalogue is cached module-wide and read by a dozen components, so on
     every navigation after the first it is already here. On the first it is
     empty for a tick — and an empty catalogue is indistinguishable from one
     that does not hold this id, so the "no such subject" message has to wait
     for it or it would flash on a perfectly good link. */
  const naming = catalogue.size === 0;

  return (
    <div className="ax-page">
      <Ambient />
      <div className="ax-shell page-shell">
        <header className="ax-head">
          <div>
            <h1>{subject ? subject.name : 'Subject'}</h1>
            <p className="ax-muted ax-head-purpose">
              {subject
                ? 'This subject on its own — what you have done in it, what is holding it back, and what to do next.'
                : 'This page is about one subject at a time.'}
            </p>
          </div>
          <div className="ax-head-actions">
            {/* On every state including the error. A reader who followed a dead
                link should land somewhere useful in one click. */}
            <Link className="ax-btn" to="/analytics">
              Overall analytics
            </Link>
          </div>
        </header>

        {naming || tasks.loading ? (
          <Loading label="Reading your record" />
        ) : !subject ? (
          <p className="ax-opening is-flat">
            No subject with that id is in your catalogue. It may have been deleted since you
            picked it — you can choose the subjects you follow again from{' '}
            <Link to="/analytics?setup">the analytics setup questions</Link>.
          </p>
        ) : !tasks.data ? (
          <ErrorState message={tasks.error ?? 'Could not read your tasks.'} onRetry={tasks.reload} />
        ) : !model.any ? (
          <p className="ax-opening is-flat">
            Nothing is filed under {subject.name} yet. This page fills in from your own tasks —
            file a few here and it will have something to measure.
          </p>
        ) : (
          <>
            <div className="ax-controls">
              <div className="ax-chips" role="group" aria-label="Time window">
                {WINDOWS.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    className={`ax-chip${option.key === span ? ' is-on' : ''}`}
                    aria-pressed={option.key === span}
                    onClick={() => setSpan(option.key)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* ---- Overview ------------------------------------------- */}
            <div className="sb-tiles">
              <div className="sb-tile">
                <span className="sb-tile-label">Subject score</span>
                <strong className="sb-tile-value">
                  {model.grade ?? '—'}
                  {model.score !== null && <em> {model.score}/100</em>}
                </strong>
                <span className="sb-tile-note">
                  {model.howScored || 'Nothing rated in this window yet.'}
                </span>
              </div>
              <div className="sb-tile">
                <span className="sb-tile-label">Finished</span>
                <strong className="sb-tile-value">{model.finished}</strong>
                <span className="sb-tile-note">
                  against {model.finishedBefore} the window before
                </span>
              </div>
              <div className="sb-tile">
                <span className="sb-tile-label">Time on it</span>
                <strong className="sb-tile-value">
                  {model.invested > 0 ? format.duration(model.invested) : '—'}
                </strong>
                <span className="sb-tile-note">
                  {model.invested > 0
                    ? 'logged against the tasks you finished'
                    : 'no time logged against these tasks'}
                </span>
              </div>
              <div className="sb-tile">
                <span className="sb-tile-label">Streak</span>
                <strong className="sb-tile-value">{model.streak}</strong>
                <span className="sb-tile-note">
                  {model.streak === 1 ? 'day running' : 'days running'} in this subject
                </span>
              </div>
            </div>

            {model.insight && <p className="ax-opening is-down sb-insight">{model.insight}</p>}

            <div className="sb-grid">
              {/* ---- Progress ----------------------------------------- */}
              <Panel
                title="Your progress"
                note="Each figure is this window against the one immediately before it, which is the same length — a longer baseline would report the extra days as effort."
              >
                <ul className="sb-rows">
                  {model.growth.map((entry) => (
                    <li key={entry.key} className="sb-row">
                      <span className="sb-row-name">{entry.label}</span>
                      <Delta value={entry.change} />
                      <span className="sb-row-note">{entry.note}</span>
                    </li>
                  ))}
                </ul>
              </Panel>

              {/* ---- The four rates ----------------------------------- */}
              <Panel
                title="What the score is made of"
                note="Four rates, each already a share of something out of something. The letter above is their mean — nothing is scaled to get there."
              >
                <ul className="sb-rows">
                  {model.rates.map((entry) => (
                    <li key={entry.key} className="sb-row sb-row-rate">
                      <span className="sb-row-name">{entry.label}</span>
                      {entry.known ? (
                        <>
                          <strong className="sb-row-value">{Math.round(entry.now)}%</strong>
                          <Bar percent={entry.now} />
                          <Delta value={entry.delta} unit="pts" />
                        </>
                      ) : (
                        <span className="sb-row-value is-none">not measurable yet</span>
                      )}
                      <span className="sb-row-note">{entry.note}</span>
                    </li>
                  ))}
                </ul>
              </Panel>
            </div>

            {/* ---- The difficulty bands ------------------------------- */}
            {model.bands.some((band) => band.done > 0) && (
              <Panel
                title="How you do at each difficulty"
                note="This is the breakdown Ascen can actually evidence. It records a difficulty star on every rated task and nothing finer than the subject itself — so these are the bands rather than named sub-topics, and every row is counted off your own ratings."
              >
                <div className="sb-table-wrap">
                  <table className="sb-table">
                    <thead>
                      <tr>
                        <th scope="col">Difficulty</th>
                        <th scope="col">Finished</th>
                        <th scope="col">How it went</th>
                        <th scope="col">vs before</th>
                        <th scope="col">Typical time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {model.bands
                        .filter((band) => band.done > 0)
                        .map((band) => (
                          <tr
                            key={band.level}
                            className={band.level === model.weakest?.level ? 'is-weak' : undefined}
                          >
                            <th scope="row">{band.label}</th>
                            <td>{band.done}</td>
                            <td>
                              {band.holding === null ? (
                                <span className="is-none">not rated</span>
                              ) : (
                                <span className="sb-cell-bar">
                                  <strong>{Math.round(band.holding)}%</strong>
                                  <Bar percent={band.holding} />
                                </span>
                              )}
                            </td>
                            <td>
                              <Delta value={band.delta} unit="pts" />
                            </td>
                            <td>
                              {band.seconds === null ? (
                                <span className="is-none">—</span>
                              ) : (
                                <>
                                  {format.duration(Math.round(band.seconds))}
                                  {band.secondsDelta !== null && band.secondsDelta !== 0 && (
                                    <em className="sb-cell-aside">
                                      {band.secondsDelta < 0 ? '↓' : '↑'}{' '}
                                      {format.duration(Math.abs(band.secondsDelta))}
                                    </em>
                                  )}
                                </>
                              )}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
                {model.weakest && model.strongest && model.weakest.level !== model.strongest.level && (
                  <p className="ax-panel-note ax-panel-note-foot">
                    <strong>Weakest:</strong> {model.weakest.label.toLowerCase()} at{' '}
                    {Math.round(model.weakest.holding!)}%. <strong>Strongest:</strong>{' '}
                    {model.strongest.label.toLowerCase()} at {Math.round(model.strongest.holding!)}%.
                    Only bands with at least three finished tasks are ranked — below that, one bad
                    afternoon is the whole sample.
                  </p>
                )}
              </Panel>
            )}

            <div className="sb-grid">
              {/* ---- What drives it --------------------------------- */}
              {(model.struggles.length > 0 || model.wentWell.length > 0) && (
                <Panel
                  title="What makes it go badly, and well"
                  note="Counted off the reason you gave when you rated each task. It is a closed list of twelve words for exactly this reason — a text box would collect twelve spellings of one answer and count none of them."
                >
                  {model.struggles.length > 0 && (
                    <>
                      <h3 className="sb-sub">When it went badly</h3>
                      <ul className="sb-rows">
                        {model.struggles.map((driver) => (
                          <li key={driver.key} className="sb-row sb-row-rate">
                            <span className="sb-row-name">{driver.label}</span>
                            <strong className="sb-row-value">{driver.share}%</strong>
                            <Bar percent={driver.share} />
                            <span className="sb-row-note">
                              {driver.count} {driver.count === 1 ? 'task' : 'tasks'}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                  {model.wentWell.length > 0 && (
                    <>
                      <h3 className="sb-sub">When it went well</h3>
                      <ul className="sb-rows">
                        {model.wentWell.map((driver) => (
                          <li key={driver.key} className="sb-row sb-row-rate">
                            <span className="sb-row-name">{driver.label}</span>
                            <strong className="sb-row-value">{driver.share}%</strong>
                            <Bar percent={driver.share} />
                            <span className="sb-row-note">
                              {driver.count} {driver.count === 1 ? 'task' : 'tasks'}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </Panel>
              )}

              {/* ---- The run --------------------------------------- */}
              {model.run.readings.length > 0 && (
                <Panel
                  title="Your last few sessions"
                  note="Quality on each of the tasks you rated, oldest first — difficulty times execution, as a percentage of the 25 it is scored out of."
                >
                  <ol className="sb-run">
                    {model.run.readings.map((reading) => (
                      <li key={reading.id}>
                        <span
                          className={`sb-run-dot ${
                            reading.percent >= 80
                              ? 'is-good'
                              : reading.percent >= 60
                                ? 'is-mid'
                                : 'is-poor'
                          }`}
                          aria-hidden="true"
                        />
                        <span className="sb-run-value">{reading.percent}%</span>
                        <span className="sb-run-day">{reading.on.slice(5)}</span>
                      </li>
                    ))}
                  </ol>
                  {model.run.trend !== null && (
                    <p className="ax-panel-note ax-panel-note-foot">
                      <strong>Trend:</strong>{' '}
                      {model.run.trend > 0
                        ? `improving — the later half of this run averages ${model.run.trend} points above the earlier half.`
                        : model.run.trend < 0
                          ? `slipping — the later half averages ${Math.abs(model.run.trend)} points below the earlier half.`
                          : 'flat — both halves of this run average the same.'}
                    </p>
                  )}
                </Panel>
              )}
            </div>

            {/* ---- What to do ------------------------------------- */}
            {model.advice.length > 0 && (
              <Panel
                title="What to do next"
                note="Each one carries the arithmetic that produced it. An instruction without a number behind it is a horoscope."
              >
                <ol className="sb-advice">
                  {model.advice.map((item, at) => (
                    <li key={item.id} className={`sb-advice-item is-${item.weight}`}>
                      <span className="sb-advice-rank" aria-hidden="true">
                        {at + 1}
                      </span>
                      <div>
                        <strong>{item.title}</strong>
                        <p>{item.detail}</p>
                        <p className="sb-advice-why">
                          <span>Why:</span> {item.why}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              </Panel>
            )}

            {/* ---- Recent work ------------------------------------- */}
            {model.recent.length > 0 && (
              <Panel
                title="Recent work"
                note="The last of this subject's tasks you finished, newest first."
              >
                <ul className="sb-recent">
                  {model.recent.map((entry) => (
                    <li key={entry.id}>
                      <div className="sb-recent-head">
                        <strong>{entry.title}</strong>
                        <span className={`sb-verdict is-${entry.verdict.replace(/\s+/g, '-')}`}>
                          {entry.verdict}
                        </span>
                      </div>
                      <p className="sb-recent-meta">
                        {entry.on}
                        {entry.quality !== null && <> · scored {entry.quality}/25</>}
                        {entry.seconds !== null && <> · {format.duration(entry.seconds)}</>}
                      </p>
                    </li>
                  ))}
                </ul>
                {model.goalAimed !== null && (
                  <p className="ax-panel-note ax-panel-note-foot">
                    <strong>{model.goalAimed}%</strong> of what you finished here in this window
                    was aimed at a goal.
                  </p>
                )}
              </Panel>
            )}
          </>
        )}
      </div>
    </div>
  );
}
