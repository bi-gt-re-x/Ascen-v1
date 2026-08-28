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
export { Topbar } from './Topbar';
export { ErrorState, Loading, NotBuilt } from './PageState';
export { RefreshButton } from './RefreshButton';
export type { RefreshButtonProps } from './RefreshButton';
export { SubjectPicker } from './SubjectPicker';
export type { SubjectPickerProps } from './SubjectPicker';
