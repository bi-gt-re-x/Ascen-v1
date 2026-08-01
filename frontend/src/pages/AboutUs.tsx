/**
 * About Us — being ported.
 *
 * The company page.
 *
 * The working version is still the server-rendered page: run the backend and
 * open it at /about-us. This component replaces it once the port lands.
 *
 * Porting from: frontend/html/aboutus.html
 */
import { NotBuilt } from '@/components';
import { useDocumentTitle } from '@/hooks';
import '@/styles/aboutus.css';

export default function AboutUs() {
  useDocumentTitle('About Us');

  return (
    <NotBuilt
      name="About Us"
      description="The company page. Still served by the original page — this is the React port, not written yet."
      files={['frontend/html/aboutus.html', 'frontend/html/aboutus.html']}
    />
  );
}
