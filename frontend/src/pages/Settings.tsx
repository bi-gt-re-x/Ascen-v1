/**
 * Account preferences.
 *
 * ## Each control saves itself
 *
 * There is no Save button and nothing to submit. A select writes on change; a
 * text field writes when it loses focus or the reader presses Enter. That is
 * the shape the rest of the app already uses — renaming a task, choosing an
 * avatar, toggling the theme — and a page of five preferences does not need a
 * form's ceremony to change one of them.
 *
 * It also means a half-finished edit cannot be saved by accident: the name
 * field writes what it holds when the reader leaves it, and leaves everything
 * else alone. The server writes only the fields it is sent, so two controls
 * can never overwrite each other.
 *
 * ## What is shown but not editable
 *
 * Username, e-mail, level and the join date. They are here because a settings
 * page is where a reader looks for them, and none of them is this page's to
 * change: a username is an identity other rows key against, and e-mail is a
 * verification flow rather than a field.
 */
import { useCallback, useEffect, useState } from 'react';
import { Ambient, ErrorState, Loading } from '@/components';
import { useApi, useDocumentTitle, useTheme, useUserData } from '@/hooks';
import { settings as service } from '@/services';
import type { Settings as Prefs, SettingsEdit } from '@/services/settings';
import '@/styles/settings.css';

const GOAL_MIN = 10;
const GOAL_MAX = 2000;

function joined(iso: string): string {
  if (!iso) return 'Unknown';
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) return 'Unknown';
  return when.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

/** One labelled control, with its explanation under the label rather than beside it. */
function Row({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="st-row">
      <div className="st-row-text">
        <label htmlFor={htmlFor}>{label}</label>
        {hint && <span className="st-quiet">{hint}</span>}
      </div>
      <div className="st-row-control">{children}</div>
    </div>
  );
}

export default function Settings() {
  useDocumentTitle('Settings');

  const { username } = useUserData();
  const call = useCallback(
    () =>
      username
        ? service.getSettings(username)
        : Promise.resolve({ success: false as const, message: 'Sign in to change your settings.' }),
    [username],
  );
  const { data, error, loading, reload, mutate } = useApi(call, [username]);
  const prefs = data?.settings ?? null;

  // The theme is the one preference something outside this page renders from,
  // so the app's own hook is told about a change here rather than left to find
  // out on the next page load.
  const { setTheme } = useTheme();

  /* The name is the only free-text field, so it is the only one held locally:
     a controlled input writing on every keystroke would be a request per
     letter. Everything else writes the value it was clicked to. */
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    if (prefs) setName(prefs.name);
  }, [prefs]);

  const save = useCallback(
    async (edit: SettingsEdit, label: string) => {
      if (!username || saving) return;
      setSaving(true);
      setFailure(null);
      const result = await service.saveSettings(username, edit);
      setSaving(false);
      if (!result.success) {
        setFailure(result.message);
        // Put the field back to what the server still holds, so the page never
        // shows a value that was not written.
        if (prefs) setName(prefs.name);
        return;
      }
      mutate((current) => ({ ...current, settings: result.settings }));
      if (edit.theme) setTheme(edit.theme);
      setSaved(label);
      window.setTimeout(() => setSaved(null), 1600);
    },
    [mutate, prefs, saving, setTheme, username],
  );

  if (loading) return <Loading label="Reading your settings" />;
  if (error && !prefs) return <ErrorState message={error} onRetry={reload} />;
  if (!prefs) return <ErrorState message="No settings to show." onRetry={reload} />;

  const commitName = () => {
    const next = name.trim();
    if (next === prefs.name) return;
    void save({ name: next }, 'Name');
  };

  return (
    <div className="st-page">
      <Ambient />
      <div className="st-shell page-shell">
        <header className="st-head">
          <div>
            <h1>Settings</h1>
            <p className="st-quiet">What this account has chosen.</p>
          </div>
          {/* One status line for the whole page, because one control writes at
              a time and a per-row spinner would be five of them doing nothing. */}
          <span className={`st-status${saved || failure ? ' is-on' : ''}`} role="status">
            {failure ? <em className="st-bad">{failure}</em> : saved ? `${saved} saved` : ''}
          </span>
        </header>

        <section className="st-card">
          <h2>Profile</h2>

          <Row label="Display name" hint="What the dashboard greets you by." htmlFor="st-name">
            <input
              id="st-name"
              className="st-input"
              value={name}
              maxLength={60}
              placeholder={prefs.username}
              disabled={saving}
              onChange={(event) => setName(event.target.value)}
              onBlur={commitName}
              onKeyDown={(event) => {
                if (event.key === 'Enter') event.currentTarget.blur();
                if (event.key === 'Escape') setName(prefs.name);
              }}
            />
          </Row>

          <Row label="Username" hint="Fixed. Everything you have made is filed under it.">
            <span className="st-fixed">{prefs.username}</span>
          </Row>

          <Row label="E-mail" hint="Changing this means verifying the new one again.">
            <span className="st-fixed">{prefs.email || 'None on file'}</span>
          </Row>
        </section>

        <section className="st-card">
          <h2>Appearance</h2>

          <Row label="Theme" hint="Applies everywhere, immediately.">
            <div className="st-choice" role="group" aria-label="Theme">
              {(['light', 'dark'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  className={`st-pick${prefs.theme === option ? ' is-on' : ''}`}
                  aria-pressed={prefs.theme === option}
                  disabled={saving}
                  onClick={() => void save({ theme: option }, 'Theme')}
                >
                  {option === 'light' ? 'Light' : 'Dark'}
                </button>
              ))}
            </div>
          </Row>

          <Row label="Week starts on" hint="Which column the calendar opens with." htmlFor="st-week">
            <select
              id="st-week"
              className="st-input"
              value={prefs.week_start}
              disabled={saving}
              onChange={(event) =>
                void save({ week_start: event.target.value as Prefs['week_start'] }, 'Week start')
              }
            >
              <option value="monday">Monday</option>
              <option value="sunday">Sunday</option>
            </select>
          </Row>
        </section>

        <section className="st-card">
          <h2>Work</h2>

          <Row
            label="Daily XP goal"
            hint={`What the dashboard ring fills against. ${GOAL_MIN}–${GOAL_MAX}.`}
            htmlFor="st-goal"
          >
            <input
              id="st-goal"
              className="st-input is-num"
              type="number"
              min={GOAL_MIN}
              max={GOAL_MAX}
              step={10}
              defaultValue={prefs.daily_goal}
              disabled={saving}
              onBlur={(event) => {
                const next = Number(event.target.value);
                if (!Number.isFinite(next) || next === prefs.daily_goal) return;
                void save({ daily_goal: next }, 'Daily goal');
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') event.currentTarget.blur();
              }}
            />
          </Row>

          <Row label="Confirm before deleting" hint="Ask first when removing a task, goal or note.">
            <button
              type="button"
              className={`st-toggle${prefs.confirm_delete ? ' is-on' : ''}`}
              role="switch"
              aria-checked={prefs.confirm_delete}
              aria-label="Confirm before deleting"
              disabled={saving}
              onClick={() => void save({ confirm_delete: !prefs.confirm_delete }, 'Confirmation')}
            >
              <i aria-hidden="true" />
            </button>
          </Row>
        </section>

        <section className="st-card">
          <h2>Account</h2>
          <dl className="st-facts">
            <div>
              <dt>Level</dt>
              <dd>{prefs.level}</dd>
            </div>
            <div>
              <dt>Lifetime XP</dt>
              <dd>{prefs.xp.toLocaleString()}</dd>
            </div>
            <div>
              <dt>Member since</dt>
              <dd>{joined(prefs.created_at)}</dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  );
}
