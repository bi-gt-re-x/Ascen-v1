/**
 * Analytics — not built yet.
 *
 * The deeper cuts of your own data, beyond the growth chart and the report card.
 */
import { NotBuilt } from '@/components';
import { useDocumentTitle } from '@/hooks';
import '@/styles/analytics.css';

export default function Analytics() {
  useDocumentTitle('Analytics');

  return (
    <NotBuilt
      name="Analytics"
      description="The deeper cuts of your own data, beyond the growth chart and the report card."
      files={[
        'backend/api/analytics.py — a stub',
        'backend/tracking/analytics.py — grading rules live here',
      ]}
    />
  );
}
