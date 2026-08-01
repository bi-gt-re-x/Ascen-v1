import { useContext } from 'react';
import { ThemeContext } from '@/context/contexts';
import type { ThemeValue } from '@/context/contexts';

/** The current theme, and how to change it. Must be inside <ThemeProvider>. */
export function useTheme(): ThemeValue {
  const value = useContext(ThemeContext);
  if (!value) {
    throw new Error('useTheme must be used inside <ThemeProvider>');
  }
  return value;
}
