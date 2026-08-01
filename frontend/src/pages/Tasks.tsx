/**
 * Tasks — not built yet.
 *
 * A page of its own for the task list — filtering, sorting and bulk edits that the dashboard panel has no room for.
 */
import { NotBuilt } from '@/components';
import { useDocumentTitle } from '@/hooks';
import '@/styles/tasks.css';

export default function Tasks() {
  useDocumentTitle('Tasks');

  return (
    <NotBuilt
      name="Tasks"
      description="A page of its own for the task list — filtering, sorting and bulk edits that the dashboard panel has no room for."
      files={[
        'backend/api/tasks.py — the endpoints already exist',
        'src/services/tasks.ts — already wired',
      ]}
    />
  );
}
