/**
 * Goals — being ported.
 *
 * Goals of all four kinds, their progress, and the milestones panel.
 *
 * The working version is still the server-rendered page: run the backend and
 * open it at /goals. This component replaces it once the port lands.
 *
 * Porting from: frontend/js/goal.js (1,371 lines), goal-auto.js, goal-notify.js
 */
import { NotBuilt } from '@/components';
import { useDocumentTitle } from '@/hooks';
import '@/styles/goals.css';

export default function Goals() {
  useDocumentTitle('Goals');

  return (
    <NotBuilt
      name="Goals"
      description="Goals of all four kinds, their progress, and the milestones panel. Still served by the original page — this is the React port, not written yet."
      files={['frontend/js/goal.js (1,371 lines), goal-auto.js, goal-notify.js', 'frontend/html/goals.html']}
    />
  );
}
