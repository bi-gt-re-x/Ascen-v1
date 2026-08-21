/**
 * Settings.
 *
 * ## Declared, not written out
 *
 * The page is a list of sections, each a list of rows, each row a label, an
 * explanation and one control. Writing that as JSX would be nine hundred lines
 * of nearly-identical markup; declaring it means a new preference is an entry
 * in `sections` and the search, the nav, the deep link and the layout all pick
 * it up for free.
 *
 * ## Search is the reason the rows are data
 *
 * A settings page is found by name, not by browsing — nobody remembers which
 * tab "confirm before deleting" lives on. With every row carrying its own
 * words, the search is a filter over that list and the result is the matching
 * rows in place, under their own headings.
 *
 * ## Each control saves itself
 *
 * No Save button. A select writes on change, a text field on blur or Enter,
 * and the status line says which preference was written. The server writes
 * only the fields it is sent, so two controls can never overwrite each other.
 *
 * ## What is not here, and why
 *
 * No integrations, API keys, webhooks, notification schedules, leaderboards or
 * password changes. This app has no OAuth broker, no job runner, no second
 * account to rank against and no change-password endpoint — every one of those
 * would be a control that stores a value nothing reads. They are worth
 * building; they are not worth faking.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Ambient, ErrorState, Loading } from '@/components';
import { useApi, useDocumentTitle, useSettings, useTheme, useUserData } from '@/hooks';
import { settings as service } from '@/services';
import type { Accent, Prefs, Settings as Prefsheet, ThemeMode } from '@/services/settings';
import '@/styles/settings.css';

const GOAL_MIN = 10;
const GOAL_MAX = 2000;

const ACCENTS: { key: Accent; label: string; swatch: string }[] = [
  { key: 'violet', label: 'Violet', swatch: '#6d5ae0' },
  { key: 'blue', label: 'Blue', swatch: '#2f6fd0' },
  { key: 'green', label: 'Green', swatch: '#1f8a54' },
  { key: 'amber', label: 'Amber', swatch: '#b8791f' },
  { key: 'rose', label: 'Rose', swatch: '#c0395f' },
  { key: 'slate', label: 'Slate', swatch: '#4a5568' },
];

/** A row's control, and the words the search matches it on. */
interface Item {
  id: string;
  label: string;
  hint: string;
  control: React.ReactNode;
  /** Set on rows that change or remove data. Drawn apart, at the end. */
  danger?: boolean;
}

interface Section {
  id: string;
  label: string;
  group: string;
  items: Item[];
}

function joined(iso: string): string {
  if (!iso) return 'Unknown';
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) return 'Unknown';
  return when.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

/** A segmented control. Two or three options, all visible. */
function Seg<T extends string>({
  value,
  options,
  onPick,
  busy,
}: {
  value: T;
  options: { key: T; label: string }[];
  onPick: (next: T) => void;
  busy: boolean;
}) {
  return (
    <div className="st-seg" role="group">
      {options.map((option) => (
        <button
          key={option.key}
          type="button"
          className={`st-pick${value === option.key ? ' is-on' : ''}`}
          aria-pressed={value === option.key}
          disabled={busy}
          onClick={() => onPick(option.key)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function Toggle({
  on,
  onFlip,
  busy,
  label,
}: {
  on: boolean;
  onFlip: () => void;
  busy: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      className={`st-toggle${on ? ' is-on' : ''}`}
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={busy}
      onClick={onFlip}
    >
      <i aria-hidden="true" />
    </button>
  );
}

export default function Settings() {
  useDocumentTitle('Settings');

  const { section: routeSection } = useParams();
  const navigate = useNavigate();
  const { username } = useUserData();
  const { prefs, update } = useSettings();
  const { setTheme } = useTheme();

  const call = useCallback(
    () =>
      username
        ? service.getSettings(username)
        : Promise.resolve({ success: false as const, message: 'Sign in to change your settings.' }),
    [username],
  );
  const { data, error, loading, reload, mutate } = useApi(call, [username]);
  const sheet: Prefsheet | null = data?.settings ?? null;

  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (sheet) setName(sheet.name);
  }, [sheet]);

  const flash = useCallback((label: string) => {
    setSaved(label);
    window.setTimeout(() => setSaved(null), 1800);
  }, []);

  /** The account-row half — name, theme, daily goal. */
  const saveSheet = useCallback(
    async (edit: Parameters<typeof service.saveSettings>[1], label: string) => {
      if (!username || busy) return;
      setBusy(true);
      setFailure(null);
      const result = await service.saveSettings(username, edit);
      setBusy(false);
      if (!result.success) {
        setFailure(result.message);
        if (sheet) setName(sheet.name);
        return;
      }
      mutate((current) => ({ ...current, settings: result.settings }));
      flash(label);
    },
    [busy, flash, mutate, sheet, username],
  );

  /** The keyed half. Goes through the provider so every page sees it at once. */
  const savePref = useCallback(
    async (values: Partial<Prefs>, label: string) => {
      if (busy) return;
      setBusy(true);
      setFailure(null);
      const message = await update(values);
      setBusy(false);
      if (message) {
        setFailure(message);
        return;
      }
      flash(label);
    },
    [busy, flash, update],
  );

  /* Light and dark are stored on the account and drive the cookie; 'system'
     is a preference about *how* to choose, so it is kept alongside and the
     resolved colour is still written so a server-rendered page agrees. */
  const pickThemeMode = useCallback(
    (mode: ThemeMode) => {
      const resolved =
        mode === 'system'
          ? window.matchMedia('(prefers-color-scheme: dark)').matches
            ? 'dark'
            : 'light'
          : mode;
      setTheme(resolved);
      void saveSheet({ theme: resolved }, 'Theme');
      void savePref({ theme_mode: mode }, 'Theme');
    },
    [savePref, saveSheet, setTheme],
  );

  const sections: Section[] = useMemo(() => {
    if (!sheet) return [];
    const commitName = () => {
      const next = name.trim();
      if (next === sheet.name) return;
      void saveSheet({ name: next }, 'Display name');
    };

    return [
      {
        id: 'profile',
        label: 'Profile',
        group: 'Account',
        items: [
          {
            id: 'name',
            label: 'Display name',
            hint: 'What the dashboard greets you by.',
            control: (
              <input
                className="st-input"
                value={name}
                maxLength={60}
                placeholder={sheet.username}
                disabled={busy}
                onChange={(event) => setName(event.target.value)}
                onBlur={commitName}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') event.currentTarget.blur();
                  if (event.key === 'Escape') setName(sheet.name);
                }}
              />
            ),
          },
          {
            id: 'avatar',
            label: 'Profile picture',
            hint: 'Chosen from the menu under your avatar, top right.',
            control: <img className="st-avatar" src={sheet.avatar} alt="" />,
          },
          {
            id: 'username',
            label: 'Username',
            hint: 'Fixed. Everything you have made is filed under it.',
            control: <span className="st-fixed">{sheet.username}</span>,
          },
          {
            id: 'email',
            label: 'E-mail',
            hint: 'Changing this means verifying the new address again.',
            control: <span className="st-fixed">{sheet.email || 'None on file'}</span>,
          },
          {
            id: 'since',
            label: 'Member since',
            hint: 'The day this account was made.',
            control: <span className="st-fixed">{joined(sheet.created_at)}</span>,
          },
        ],
      },
      {
        id: 'appearance',
        label: 'Appearance',
        group: 'Personalization',
        items: [
          {
            id: 'theme',
            label: 'Theme',
            hint: 'System follows your device. Applies everywhere, immediately.',
            control: (
              <Seg
                value={prefs.theme_mode}
                busy={busy}
                onPick={pickThemeMode}
                options={[
                  { key: 'system', label: 'System' },
                  { key: 'light', label: 'Light' },
                  { key: 'dark', label: 'Dark' },
                ]}
              />
            ),
          },
          {
            id: 'accent',
            label: 'Accent colour',
            hint: 'The colour Ascen uses for progress, links and highlights.',
            control: (
              <div className="st-swatches" role="group" aria-label="Accent colour">
                {ACCENTS.map((accent) => (
                  <button
                    key={accent.key}
                    type="button"
                    className={`st-swatch${prefs.accent === accent.key ? ' is-on' : ''}`}
                    style={{ '--swatch': accent.swatch } as React.CSSProperties}
                    aria-pressed={prefs.accent === accent.key}
                    aria-label={accent.label}
                    title={accent.label}
                    disabled={busy}
                    onClick={() => void savePref({ accent: accent.key }, 'Accent')}
                  />
                ))}
              </div>
            ),
          },
          {
            id: 'motion',
            label: 'Reduce animations',
            hint: 'Turns off page transitions and bar animations across the app.',
            control: (
              <Toggle
                on={prefs.reduce_motion}
                busy={busy}
                label="Reduce animations"
                onFlip={() => void savePref({ reduce_motion: !prefs.reduce_motion }, 'Motion')}
              />
            ),
          },
        ],
      },
      {
        id: 'dashboard',
        label: 'Dashboard',
        group: 'Personalization',
        items: [
          {
            id: 'goal',
            label: 'Daily XP goal',
            hint: `What the dashboard ring fills against. ${GOAL_MIN}–${GOAL_MAX}.`,
            control: (
              <input
                className="st-input is-num"
                type="number"
                min={GOAL_MIN}
                max={GOAL_MAX}
                step={10}
                defaultValue={sheet.daily_goal}
                disabled={busy}
                onBlur={(event) => {
                  const next = Number(event.target.value);
                  if (!Number.isFinite(next) || next === sheet.daily_goal) return;
                  void saveSheet({ daily_goal: next }, 'Daily goal');
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') event.currentTarget.blur();
                }}
              />
            ),
          },
          {
            id: 'stats',
            label: 'Show the statistics row',
            hint: 'The four figures across the top of the dashboard.',
            control: (
              <Toggle
                on={prefs.show_stats}
                busy={busy}
                label="Show the statistics row"
                onFlip={() => void savePref({ show_stats: !prefs.show_stats }, 'Dashboard')}
              />
            ),
          },
          {
            id: 'insights',
            label: 'Show the insights panel',
            hint: 'The readings under your task list.',
            control: (
              <Toggle
                on={prefs.show_insights}
                busy={busy}
                label="Show the insights panel"
                onFlip={() => void savePref({ show_insights: !prefs.show_insights }, 'Dashboard')}
              />
            ),
          },
        ],
      },
      {
        id: 'tasks',
        label: 'Tasks',
        group: 'Productivity',
        items: [
          {
            id: 'priority',
            label: 'Default priority',
            hint: 'What Quick Add starts a new task at.',
            control: (
              <Seg
                value={prefs.default_priority}
                busy={busy}
                onPick={(next) => void savePref({ default_priority: next }, 'Default priority')}
                options={[
                  { key: 'low', label: 'Low' },
                  { key: 'medium', label: 'Medium' },
                  { key: 'high', label: 'High' },
                ]}
              />
            ),
          },
          {
            id: 'xp',
            label: 'Default XP',
            hint: 'What a new task is worth before you change it.',
            control: (
              <input
                className="st-input is-num"
                type="number"
                min={5}
                max={500}
                step={5}
                defaultValue={prefs.default_xp}
                disabled={busy}
                onBlur={(event) => {
                  const next = Number(event.target.value);
                  if (!Number.isFinite(next) || next === prefs.default_xp) return;
                  void savePref({ default_xp: next }, 'Default XP');
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') event.currentTarget.blur();
                }}
              />
            ),
          },
          {
            id: 'rating',
            label: 'Ask how it went',
            hint: 'The two star rows after you finish a task. They feed Quality on Analytics.',
            control: (
              <Toggle
                on={prefs.ask_rating}
                busy={busy}
                label="Ask how it went"
                onFlip={() => void savePref({ ask_rating: !prefs.ask_rating }, 'Rating prompt')}
              />
            ),
          },
          {
            id: 'confirm',
            label: 'Confirm before deleting',
            hint: 'Ask first when removing a task. Off means it goes immediately.',
            control: (
              <Toggle
                on={prefs.confirm_delete}
                busy={busy}
                label="Confirm before deleting"
                onFlip={() =>
                  void savePref({ confirm_delete: !prefs.confirm_delete }, 'Confirmation')
                }
              />
            ),
            danger: true,
          },
        ],
      },
      {
        id: 'calendar',
        label: 'Calendar',
        group: 'Productivity',
        items: [
          {
            id: 'view',
            label: 'Default view',
            hint: 'Which one opens when you go to the calendar.',
            control: (
              <Seg
                value={prefs.calendar_view}
                busy={busy}
                onPick={(next) => void savePref({ calendar_view: next }, 'Calendar view')}
                options={[
                  { key: 'day', label: 'Day' },
                  { key: 'week', label: 'Week' },
                  { key: 'month', label: 'Month' },
                ]}
              />
            ),
          },
        ],
      },
      {
        id: 'analytics',
        label: 'Analytics',
        group: 'Data',
        items: [
          {
            id: 'window',
            label: 'Default period',
            hint: 'The range Analytics opens on. You can still change it there.',
            control: (
              <select
                className="st-input"
                value={prefs.analytics_window}
                disabled={busy}
                onChange={(event) =>
                  void savePref(
                    { analytics_window: event.target.value as Prefs['analytics_window'] },
                    'Analytics period',
                  )
                }
              >
                <option value="7d">7 days</option>
                <option value="30d">30 days</option>
                <option value="90d">90 days</option>
                <option value="1y">1 year</option>
                <option value="2y">2 years</option>
                <option value="all">All time</option>
              </select>
            ),
          },
        ],
      },
      {
        id: 'data',
        label: 'Data & export',
        group: 'Data',
        items: [
          {
            id: 'export-json',
            label: 'Export everything',
            hint: 'Tasks, goals, records, notes and focus days, as one JSON file.',
            control: (
              <a
                className="st-btn"
                href={service.exportUrl(sheet.username, 'all', 'json')}
                download
              >
                Download JSON
              </a>
            ),
          },
          {
            id: 'export-csv',
            label: 'Export a table',
            hint: 'One table at a time, as CSV — a spreadsheet cannot hold five shapes at once.',
            control: (
              <div className="st-links">
                {['tasks', 'goals', 'records'].map((table) => (
                  <a
                    key={table}
                    className="st-btn is-small"
                    href={service.exportUrl(sheet.username, table, 'csv')}
                    download
                  >
                    {table}
                  </a>
                ))}
              </div>
            ),
          },
          {
            id: 'storage',
            label: 'Where your data lives',
            hint: 'On the machine running Ascen. Nothing is uploaded anywhere.',
            control: <span className="st-fixed">This device</span>,
          },
        ],
      },
      {
        id: 'about',
        label: 'About',
        group: 'System',
        items: [
          {
            id: 'version',
            label: 'Version',
            hint: 'The build you are running.',
            control: <span className="st-fixed">Ascen 1.2.0</span>,
          },
          {
            id: 'level',
            label: 'Level and XP',
            hint: 'Counted from everything you have finished.',
            control: (
              <span className="st-fixed">
                Level {sheet.level} · {sheet.xp.toLocaleString()} XP
              </span>
            ),
          },
          {
            id: 'legal',
            label: 'Terms and privacy',
            hint: 'What the app does with what it holds.',
            control: (
              <div className="st-links">
                <Link className="st-btn is-small" to="/terms">Terms</Link>
                <Link className="st-btn is-small" to="/privacy">Privacy</Link>
                <Link className="st-btn is-small" to="/about">About</Link>
              </div>
            ),
          },
        ],
      },
    ];
  }, [busy, name, pickThemeMode, prefs, savePref, saveSheet, sheet]);

  const current = useMemo(
    () => sections.find((entry) => entry.id === routeSection) ?? sections[0] ?? null,
    [routeSection, sections],
  );

  /* With a search running the nav stops being the thing that chooses what is
     shown: every section is drawn, filtered to its matching rows, and the ones
     with nothing left drop out. */
  const term = query.trim().toLowerCase();
  const results = useMemo(() => {
    if (!term) return null;
    return sections
      .map((entry) => ({
        ...entry,
        items: entry.items.filter((item) =>
          `${item.label} ${item.hint} ${entry.label}`.toLowerCase().includes(term),
        ),
      }))
      .filter((entry) => entry.items.length > 0);
  }, [sections, term]);

  const groups = useMemo(() => {
    const out: { group: string; entries: Section[] }[] = [];
    sections.forEach((entry) => {
      const found = out.find((row) => row.group === entry.group);
      if (found) found.entries.push(entry);
      else out.push({ group: entry.group, entries: [entry] });
    });
    return out;
  }, [sections]);

  if (loading) return <Loading label="Reading your settings" />;
  if (error && !sheet) return <ErrorState message={error} onRetry={reload} />;
  if (!sheet) return <ErrorState message="No settings to show." onRetry={reload} />;

  const shown = results ?? (current ? [current] : []);

  return (
    <div className="st-page">
      <Ambient />
      <div className="st-shell page-shell">
        <header className="st-head">
          <div>
            <h1>Settings</h1>
            <p className="st-quiet">What this account has chosen.</p>
          </div>
          <span className={`st-status${saved || failure ? ' is-on' : ''}`} role="status">
            {failure ? <em className="st-bad">{failure}</em> : saved ? `${saved} saved` : ''}
          </span>
        </header>

        <div className="st-body">
          <nav className="st-nav" aria-label="Settings sections">
            <input
              className="st-search"
              type="search"
              placeholder="Search settings…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="Search settings"
            />
            {groups.map((row) => (
              <div className="st-nav-group" key={row.group}>
                <h2>{row.group}</h2>
                {row.entries.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    className={`st-nav-link${
                      !term && current?.id === entry.id ? ' is-on' : ''
                    }`}
                    onClick={() => {
                      setQuery('');
                      navigate(`/settings/${entry.id}`);
                    }}
                  >
                    {entry.label}
                  </button>
                ))}
              </div>
            ))}
          </nav>

          <div className="st-content">
            {term && shown.length === 0 && (
              <p className="st-empty">Nothing here matches “{query.trim()}”.</p>
            )}

            {shown.map((entry) => {
              const plain = entry.items.filter((item) => !item.danger);
              const risky = entry.items.filter((item) => item.danger);
              return (
                <section className="st-card" key={entry.id}>
                  <h2>{entry.label}</h2>
                  {plain.map((item) => (
                    <div className="st-row" key={item.id}>
                      <div className="st-row-text">
                        <span className="st-label">{item.label}</span>
                        <span className="st-quiet">{item.hint}</span>
                      </div>
                      <div className="st-row-control">{item.control}</div>
                    </div>
                  ))}
                  {risky.length > 0 && (
                    <div className="st-risky">
                      {risky.map((item) => (
                        <div className="st-row" key={item.id}>
                          <div className="st-row-text">
                            <span className="st-label">{item.label}</span>
                            <span className="st-quiet">{item.hint}</span>
                          </div>
                          <div className="st-row-control">{item.control}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
