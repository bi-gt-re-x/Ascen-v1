/**
 * The two places a notification is drawn.
 *
 * `NotificationPanel` is the bell's list, rendered inside the top bar's panel;
 * `Toasts` is the stack over the page. Both read the one list in
 * context/NotificationsProvider — see the note there for why there is one.
 * What they agree about (colour, wording, "how long ago") is in `tone.ts`.
 */
export { NotificationPanel } from './Panel';
export { Toasts } from './Toasts';
export { CHANNEL_NAMES, TONE_NAMES, ago } from './tone';
