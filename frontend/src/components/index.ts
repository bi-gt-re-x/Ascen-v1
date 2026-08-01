/**
 * Shared components.
 *
 * The flat ones are the building blocks every page uses; the folders group the
 * pieces that belong to one feature (Calendar, Goals, Growth, Charts) and are
 * imported from their own path — `@/components/Calendar` — so this file does
 * not become a list of everything in the app.
 */
export { Button } from './Button';
export type { ButtonProps, ButtonSize, ButtonVariant } from './Button';
export { Card } from './Card';
export type { CardProps } from './Card';
export { Modal } from './Modal';
export type { ModalProps } from './Modal';
export { Navbar } from './Navbar';
export { EmptyState, ErrorState, Loading, NotBuilt } from './PageState';
export { ProgressBar } from './ProgressBar';
export type { ProgressBarProps } from './ProgressBar';
export { Sidebar } from './Sidebar';
export type { SidebarItem, SidebarProps } from './Sidebar';
