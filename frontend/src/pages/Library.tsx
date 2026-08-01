/**
 * Library — not built yet.
 *
 * Saved resources and reference material.
 */
import { NotBuilt } from '@/components';
import { useDocumentTitle } from '@/hooks';
import '@/styles/library.css';

export default function Library() {
  useDocumentTitle('Library');

  return (
    <NotBuilt
      name="Library"
      description="Saved resources and reference material."
      files={[
        'backend/api/library.py — a stub',
        'data/sql/library.sql — tables exist, schema only',
      ]}
    />
  );
}
