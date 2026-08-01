/**
 * Privacy Policy — being ported.
 *
 * The privacy policy.
 *
 * The working version is still the server-rendered page: run the backend and
 * open it at /privacy-policy. This component replaces it once the port lands.
 *
 * Porting from: frontend/html/privacy-policy.html
 */
import { NotBuilt } from '@/components';
import { useDocumentTitle } from '@/hooks';
import '@/styles/privacy-policy.css';

export default function PrivacyPolicy() {
  useDocumentTitle('Privacy Policy');

  return (
    <NotBuilt
      name="Privacy Policy"
      description="The privacy policy. Still served by the original page — this is the React port, not written yet."
      files={['frontend/html/privacy-policy.html', 'frontend/html/privacy-policy.html']}
    />
  );
}
