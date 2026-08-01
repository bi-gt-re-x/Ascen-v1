/**
 * Achievements — not built yet.
 *
 * Badges earned for milestones — streaks held, levels reached, goals finished.
 */
import { NotBuilt } from '@/components';
import { useDocumentTitle } from '@/hooks';
import '@/styles/achievements.css';

export default function Achievements() {
  useDocumentTitle('Achievements');

  return (
    <NotBuilt
      name="Achievements"
      description="Badges earned for milestones — streaks held, levels reached, goals finished."
      files={[
        'backend/api/achievements.py — a stub',
        'data/sql/achievements.sql — tables exist, schema only',
      ]}
    />
  );
}
