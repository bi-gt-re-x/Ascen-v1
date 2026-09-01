/**
 * Shared components — the ones that belong to no single page.
 *
 * The folders beside this file group the pieces that belong to one feature
 * (Calendar, Goals, Growth, Analytics, Dashboard, Home) and are imported from
 * their own path — `@/components/Calendar` — so this list stays short.
 *
 * It is short now because it was a speculative UI kit and is not any more.
 * Button, Card, Modal, ProgressBar, Sidebar and the Charts folder were written
 * against a structure the app might grow into and never imported by anything;
 * they were deleted rather than left as a second way to build a card that
 * disagrees with the `.card` every real page already uses. Git history has
 * them if a page ever wants one back.
 */
export { AppBoundary, ErrorBoundary, RootBoundary } from './ErrorBoundary';
export { Ambient } from './Ambient';
export type { AmbientProps } from './Ambient';
export { Rail, STATS_CHANGED } from './Rail';
/* The bell's two faces. In this list rather than behind their own path
   because neither belongs to a page: the panel is drawn inside the top bar and
   the pop-ups float over whatever is open. See components/Notifications. */
export { NotificationPanel, Toasts } from './Notifications';
/* The search panel, for the same reason: it belongs to the top bar rather
   than to a page. Its index of the app's containers is utils/siteIndex. */
export { SearchPanel } from './Search';
export type { Hit, SearchPanelProps } from './Search';
export { Topbar } from './Topbar';
export { ErrorState, Loading, NotBuilt } from './PageState';
export { RefreshButton } from './RefreshButton';
export type { RefreshButtonProps } from './RefreshButton';
export { SubjectPicker } from './SubjectPicker';
export type { SubjectPickerProps } from './SubjectPicker';
