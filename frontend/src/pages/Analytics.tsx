/**
 * Analytics — the graded report card.
 *
 * Ported from the analytics.html template and the ratings half of
 * frontend/js/growth.js. The markup and class names are the originals, so
 * styles/growth.css — where every `grade-*`, `ratings-*` and `detail-card`
 * rule still lives, because this page and /growth were one page until the
 * split — dresses it unchanged.
 *
 * The page is a read and nothing else: no writes, no dialogs, no state beyond
 * the request. What it does have is a side effect on the far side of that
 * read — asking for the report card files a dated row per metric into
 * analytics.sql, which is how the grades accumulate a history (see
 * backend/tracking/analytics.py). That is why there is no 30-second refresh
 * here even though growth.js had one: five grades that move on the scale of a
 * week do not need re-reading twice a minute, and every re-read wrote another
 * snapshot for the privilege.
 *
 * Two columns, and the left one is the card. On a phone growth.css stacks
 * them — the report first, the scoring detail under it.
 */
import { GradeCard, ScoringDetails } from '@/components/Analytics';
import { ErrorState, Loading } from '@/components';
import { useApi, useAuth, useDocumentTitle } from '@/hooks';
import { growth as growthService } from '@/services';
import type { ApiResult, Ratings } from '@/types';
import '@/styles/growth.css';
import '@/styles/analytics.css';

export default function Analytics() {
  useDocumentTitle('Analytics');
  const { username } = useAuth();

  // The route is behind RequireAccount, so no username here means the account
  // check has not resolved rather than that nobody is signed in. Either way
  // there is nothing to grade, and saying so is better than asking the backend
  // to answer 'Username required'.
  const { data, error, loading, reload } = useApi<Ratings>(
    (): Promise<ApiResult<Ratings>> =>
      username
        ? growthService.ratings(username)
        : Promise.resolve({
            success: false,
            message: 'Sign in to see your report card.',
          }),
    [username],
  );

  if (loading) return <Loading label="Grading your work" />;
  if (error || !data) {
    return (
      <ErrorState
        message={error ?? 'No report card yet.'}
        onRetry={username ? reload : undefined}
      />
    );
  }

  return (
    <div className="growth-container analytics-container">
      {/* #ratingsView is a styling handle, not a script's: growth.css sizes
          this view by id (`#ratingsView.ratings-view`), so it stays. */}
      <div className="ratings-view page-shell" id="ratingsView">
        <div className="ratings-main">
          <GradeCard ratings={data} />
        </div>
        <ScoringDetails />
      </div>
    </div>
  );
}
