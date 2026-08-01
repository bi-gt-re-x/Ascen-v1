/**
 * Growth — being ported.
 *
 * The growth chart with its five series, and the graded report card.
 *
 * The working version is still the server-rendered page: run the backend and
 * open it at /growth. This component replaces it once the port lands.
 *
 * Porting from: frontend/js/growth.js (1,005 lines) and home-charts.js
 */
import { NotBuilt } from '@/components';
import { useDocumentTitle } from '@/hooks';
import '@/styles/growth.css';

export default function Growth() {
  useDocumentTitle('Growth');

  return (
    <NotBuilt
      name="Growth"
      description="The growth chart with its five series, and the graded report card. Still served by the original page — this is the React port, not written yet."
      files={['frontend/js/growth.js (1,005 lines) and home-charts.js', 'frontend/html/growth.html']}
    />
  );
}
