import { useContext } from 'react';
import { AuthContext } from '@/context/contexts';
import type { AuthValue } from '@/context/contexts';

/** Who is signed in. Must be inside <AuthProvider>. */
export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return value;
}
