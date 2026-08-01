/**
 * Focus — not built yet.
 *
 * The focus timer as a page rather than a dashboard panel, with the session history behind it.
 */
import { NotBuilt } from '@/components';
import { useDocumentTitle } from '@/hooks';
import '@/styles/focus.css';

export default function Focus() {
  useDocumentTitle('Focus');

  return (
    <NotBuilt
      name="Focus"
      description="The focus timer as a page rather than a dashboard panel, with the session history behind it."
      files={[
        'backend/api/focus.py — sync and history already exist',
        'src/services/focus.ts — already wired',
        'frontend/js/timer.js — the timer to port',
      ]}
    />
  );
}
