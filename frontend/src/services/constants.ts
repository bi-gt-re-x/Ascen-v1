/**
 * The values more than one place needs to agree on.
 *
 * Anything the backend also knows is noted with where it lives there, because
 * these two have to be changed together.
 */

/**
 * Where the API is.
 *
 * Empty by default, meaning same-origin: in development Vite proxies /api to
 * the backend (vite.config.ts), and in production the backend serves the built
 * app, so both are same-origin and the session cookie just works. Set
 * VITE_API_BASE only to point at a backend somewhere else.
 */
export const API_BASE = import.meta.env['VITE_API_BASE'] ?? '';

/** XP needed for level N is N * LEVEL_XP_STEP. Backend: config/settings.py. */
export const LEVEL_XP_STEP = 100;

/** How many days of the series the growth chart shows. Backend: tracking/growth.py. */
export const GROWTH_WINDOW_DAYS = 30;

/** Backend: api/focus.py. */
export const MAX_FOCUS_SECONDS = 86_400;
export const MIN_GOAL_HOURS = 0.5;
export const MAX_GOAL_HOURS = 12;
/** The most one hand-entered catch-up may claim for a day. A day holds 24h. */
export const MAX_LOG_MINUTES = 1440;

/** Backend: api/goals.py clamps to this range. */
export const MIN_PRIORITY = 1;
export const MAX_PRIORITY = 10;

/** The four kinds of goal, and which pair of fields each counts with. */
export const GOAL_FIELDS = {
  xp: { current: 'current_xp', target: 'target_xp', unit: 'XP' },
  streak: { current: 'current_streak', target: 'target_streak', unit: 'Days' },
  tasks: { current: 'current_tasks', target: 'target_tasks', unit: 'Tasks' },
  focus: { current: 'current_focus', target: 'target_focus', unit: 'Min' },
} as const;

/**
 * Where the signed-in username is kept.
 *
 * The session cookie is the real answer to "who is signed in" — this is a
 * copy the pages read synchronously so they can fetch without waiting on a
 * round trip. The server re-seeds it when it disagrees.
 */
export const USERNAME_KEY = 'username';

/** The routes that need an account. Backend: middleware/gate.py GATED_PATHS. */
export const GATED_ROUTES = ['/dashboard', '/calendar', '/goals', '/growth'];
