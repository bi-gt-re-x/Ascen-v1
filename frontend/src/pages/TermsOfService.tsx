/**
 * Terms of Service — being ported.
 *
 * The terms of service.
 *
 * The working version is still the server-rendered page: run the backend and
 * open it at /terms-of-service. This component replaces it once the port lands.
 *
 * Porting from: frontend/html/terms-of-service.html
 */
import { NotBuilt } from '@/components';
import { useDocumentTitle } from '@/hooks';
import '@/styles/terms-of-service.css';

export default function TermsOfService() {
  useDocumentTitle('Terms of Service');

  return (
    <NotBuilt
      name="Terms of Service"
      description="The terms of service. Still served by the original page — this is the React port, not written yet."
      files={['frontend/html/terms-of-service.html', 'frontend/html/terms-of-service.html']}
    />
  );
}
