/**
 * Home — being ported.
 *
 * The landing page, the sign-in popup and the whole intro animation.
 *
 * The working version is still the server-rendered page: run the backend and
 * open it at /home. This component replaces it once the port lands.
 *
 * Porting from: frontend/js/home-*.js (11 files, ~2,000 lines) and frontend/js/auth-flow.js
 */
import { NotBuilt } from '@/components';
import { useDocumentTitle } from '@/hooks';
import '@/styles/homepage.css';

export default function Homepage() {
  useDocumentTitle('Home');

  return (
    <NotBuilt
      name="Home"
      description="The landing page, the sign-in popup and the whole intro animation. Still served by the original page — this is the React port, not written yet."
      files={['frontend/js/home-*.js (11 files, ~2,000 lines) and frontend/js/auth-flow.js', 'frontend/html/homepage.html']}
    />
  );
}
