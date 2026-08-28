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
import { RootBoundary } from '@/components';
import {
  AuthProvider,
  SettingsProvider,
  StatsProvider,
  ThemeProvider,
  UserDataProvider,
} from '@/context';

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
    {/* Outside the providers, because a provider throwing is exactly the case
        the boundary inside App.tsx cannot catch — there would be no App. */}
    <RootBoundary>
      <BrowserRouter>
        <ThemeProvider>
          <AuthProvider>
            <SettingsProvider>
              {/* The account's six numbers, for the rail and the top bar,
                  which mount on every screen behind the login. Above
                  UserDataProvider because that one writes its stats here
                  rather than keeping a second copy — one state, so the top bar
                  and the dashboard cannot disagree about the XP. This is also
                  the read that decays a stale streak. */}
              <StatsProvider>
                {/* The task list. Above App so it is read once for the session
                    rather than once per caller, and demand-gated so a session
                    that never opens a task page never reads it at all. See
                    context/UserDataProvider. */}
                <UserDataProvider>
                  <App />
                </UserDataProvider>
              </StatsProvider>
            </SettingsProvider>
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    </RootBoundary>
  </StrictMode>,
);
