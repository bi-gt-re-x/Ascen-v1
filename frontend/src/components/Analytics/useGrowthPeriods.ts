/**
 * The Growth tab's period, and the scores for it.
 *
 * ## Why this is not in useAnalyticsData
 *
 * That file is "everything the analytics page asks the server for", and the
 * rule it opens with is that a tab costs no request: every panel on the other
 * six tabs is arithmetic over the same three responses, so opening a tab is
 * free and two tabs cannot disagree about a figure.
 *
 * This call would have broken that rule if it lived there. It is scoped to a
 * period the *Growth tab* owns — no other tab has that control — and it
 * refetches whenever the reader presses a different one, so putting it beside
 * the shared reads would have made every visit to Recommendations pay for six
 * windows of scoring it never looks at.
 *
 * So it lives here and is called from the tab, which the page only mounts when
 * the tab is open (see pages/Analytics). The rule survives with one stated
 * exception rather than being quietly abandoned, and the exception is one file
 * with its reasons in it.
 *
 * ## Why the scoring is not on the client
 *
 * The long answer is on the endpoint in backend/api/analytics.py. The short
 * one is that two of the five metrics cannot be computed from what the browser
 * holds — focus needs each day's goal, which the growth series does not carry —
 * and mirroring the other three in TypeScript would create a second scoring
 * implementation, which backend/tracking/analytics.py has one rule against.
 *
 * ## The period is not written back
 *
 * Same decision the window picker makes in useAnalyticsModel, for the same
 * reason: pressing a period is a reader changing their mind for one visit, and
 * saving it would turn every glance into a preference.
 */
import { useCallback, useState } from 'react';
import { useApi, useStats } from '@/hooks';
import { analytics as analyticsService } from '@/services';
import type { GrowthPeriods, PeriodKey } from '@/services/analytics';

/**
 * Which period the tab opens on.
 *
 * Thirty days, because it is the shortest window that answers "have I changed"
 * rather than "how was my week" — seven days is a week's noise, and a reader
 * who wants that presses it. It is also the only window on the row whose
 * previous equivalent almost always exists, so the tab opens with a comparison
 * rather than with a dash.
 */
export const DEFAULT_PERIOD: PeriodKey = '30d';

export function useGrowthPeriods() {
  /* `useStats`, not `useUserData`. Both carry the name; only one of them
     charges the account's whole task list for it, and reaching for it here
     would have turned that request back on for the Growth tab alone — after
     the rest of this page had just stopped making it. The warning is in
     hooks/useUserData's own doc comment. */
  const { username } = useStats();
  const [period, setPeriod] = useState<PeriodKey>(DEFAULT_PERIOD);

  const call = useCallback(
    () =>
      username
        ? analyticsService.growthPeriods(period)
        : Promise.resolve({ success: false as const, message: 'Sign in to see your growth.' }),
    [period, username],
  );

  const periods = useApi<GrowthPeriods>(call, [period, username]);

  return { period, setPeriod, periods };
}

export type GrowthPeriodsState = ReturnType<typeof useGrowthPeriods>;
