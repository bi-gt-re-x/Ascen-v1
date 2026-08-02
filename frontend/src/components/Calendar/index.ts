/**
 * The calendar's parts, shared by the Day, Week and Month views.
 *
 * The three views are pages (src/pages/Calendar/); what lives here is what
 * more than one of them needs — the card and the view selector, the time grid
 * and its blocks, the dialogs, and the two sidebars. The arithmetic behind
 * them is in src/utils/calendar*.ts, which knows nothing about React.
 */
export { CalendarShell, ViewSwitcher } from './CalendarShell';
export type { CalendarShellProps } from './CalendarShell';
export { CardMenu } from './CardMenu';
export type { CardMenuProps } from './CardMenu';
export { DayPanel } from './DayPanel';
export type { DayPanelProps } from './DayPanel';
export { DayProgress } from './DayProgress';
export type { DayProgressProps } from './DayProgress';
export { DaySidebar } from './DaySidebar';
export type { DaySidebarProps, DayStats } from './DaySidebar';
export { EventModal } from './EventModal';
export type { EventModalProps } from './EventModal';
export { GridBlock } from './GridBlock';
export type { GridBlockProps } from './GridBlock';
export { MiniMonth } from './MiniMonth';
export type { MiniMonthProps } from './MiniMonth';
export { MonthGrid } from './MonthGrid';
export type { MonthGridProps } from './MonthGrid';
export { ConflictDialog, DeleteConfirm } from './Prompts';
export type { ConflictDialogProps, DeleteConfirmProps } from './Prompts';
export { RecurrencePicker } from './RecurrencePicker';
export type { RecurrencePickerProps } from './RecurrencePicker';
export { MAX_TASK_XP, MIN_TASK_XP, TaskModal, xpToPriority } from './TaskModal';
export type { TaskDraft, TaskModalProps } from './TaskModal';
export { DayColumn, TimeLabels, nowFor } from './TimeGrid';
export type { DayColumnProps, TimeLabelsProps } from './TimeGrid';
export { TimePicker, minutesToTime, spanMinutes } from './TimePicker';
export type { TimePickerProps } from './TimePicker';
export { WeekSidebar } from './WeekSidebar';
export type { WeekSidebarProps, WeekStats } from './WeekSidebar';
export { dayEntries, dayProgress } from './entries';
export type { DayEntry } from './entries';
