import { useContext } from 'react';
import { SettingsContext } from '@/context/contexts';
import type { SettingsValue } from '@/context/contexts';

/** The account's preferences. Must be inside <SettingsProvider>. */
export function useSettings(): SettingsValue {
  const value = useContext(SettingsContext);
  if (!value) {
    throw new Error('useSettings must be used inside <SettingsProvider>');
  }
  return value;
}
