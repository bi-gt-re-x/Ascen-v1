/**
 * Where the app starts.
 *
 * The stylesheets imported here are the ones every page depends on:
 * `grades.css` is the letter-grade palette every page that shows one reads,
 * `layout.css` is the shared responsive foundation (`.page-shell`, the
 * 1024/768/480 breakpoints), `page-enter.css` is the arrival cascade every
 * page shares (hooks/usePageEntrance), and `navbar.css` dresses the top bar,
 * which is rendered outside the router and so belongs to no page. Everything
 * else is imported by the page that needs it, so a route nobody visits costs
 * nothing.
 *
 * StrictMode double-invokes effects in development on purpose. That is a
 * feature here rather than a nuisance: it is what catches a fetch that sets
 * state after unmount, which is exactly the bug `useApi` guards against.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider, SettingsProvider, ThemeProvider } from '@/context';

import '@/styles/grades.css';
import '@/styles/layout.css';
import '@/styles/page-enter.css';
import '@/styles/preferences.css';
import '@/styles/rail.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('index.html is missing <div id="root">');
}

createRoot(container).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <SettingsProvider>
            <App />
          </SettingsProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>,
);
