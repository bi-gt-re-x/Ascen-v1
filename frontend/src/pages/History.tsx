/**
 * History — not built yet.
 *
 * A searchable record of everything already done.
 */
import { NotBuilt } from '@/components';
import { useDocumentTitle } from '@/hooks';
import '@/styles/history.css';

export default function History() {
  useDocumentTitle('History');

  return (
    <NotBuilt
      name="History"
      description="A searchable record of everything already done."
      files={[
        'backend/api/history.py — a stub',
        'data/sql/history.sql — tables exist, schema only',
      ]}
    />
  );
}
