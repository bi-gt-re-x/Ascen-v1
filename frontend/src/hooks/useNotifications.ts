/**
 * The bell's list.
 *
 * A reader of <NotificationsProvider>, not a fetch — there is exactly one list
 * in the app and the panel, the badge and the pop-ups all draw from it. See
 * context/NotificationsProvider for why it must be one.
 */
import { useContext } from 'react';
import { NotificationsContext } from '@/context/contexts';
import type { NotificationsValue } from '@/context/contexts';

/** The account's notifications. Must be inside <NotificationsProvider>. */
export function useNotifications(): NotificationsValue {
  const value = useContext(NotificationsContext);
  if (!value) {
    throw new Error('useNotifications must be used inside <NotificationsProvider>');
  }
  return value;
}
