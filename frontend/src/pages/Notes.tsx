/**
 * Notes — not built yet.
 *
 * Free-form notes attached to days, tasks or goals.
 */
import { NotBuilt } from '@/components';
import { useDocumentTitle } from '@/hooks';
import '@/styles/notes.css';

export default function Notes() {
  useDocumentTitle('Notes');

  return (
    <NotBuilt
      name="Notes"
      description="Free-form notes attached to days, tasks or goals."
      files={[
        'backend/api/notes.py — a stub',
        'data/sql/notes.sql — tables exist, schema only',
      ]}
    />
  );
}
