/**
 * Growth — the five series, drawn on canvas.
 *
 * Ported from the growth.html template and the charting half of
 * frontend/js/growth.js. The markup and class names are the originals, so
 * styles/growth.css dresses this unchanged — including the canvases, which
 * that stylesheet sizes **by id**, which is why each one still carries its
 * own.
 *
 * The report card the same file also drew belongs to /analytics, which is a
 * page of its own now; the ratings half of growth.js goes with it rather than
 * here.
 *
 * Only the chosen chart is mounted. The original kept all five canvases in the
 * DOM and toggled `.active` on their panes, which meant four hidden canvases
 * being sized and painted on every resize and every refresh. One at a time is
 * the same page with a quarter of the work — and it is what makes the entrance
 * play on the chart you just chose without any bookkeeping about which ones
 * have already played.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { ErrorState, Loading } from '@/components';
import { GrowthChart } from '@/components/Growth';
import { useAuth, useDocumentTitle } from '@/hooks';
import { growth as growthService } from '@/services';
import {
  emptyChartData,
  processData,
  TAB_TO_TYPE,
  type ChartData,
} from '@/utils/growthChart';
import '@/styles/growth.css';

/** How often the series is re-read while the page is open. */
const REFRESH_MS = 30_000;

/** The tabs, in the order the original laid them out. */
const TABS = [
  {
    name: 'cumulative',
    label: 'Cumulative Growth',
    title: 'Cumulative XP Progress Over Time',
    canvasId: 'growthChart',
  },
  {
    name: 'daily',
    label: 'Daily XP',
    title: 'Daily XP Earned',
    canvasId: 'dailyXpChart',
  },
  {
    name: 'average',
    label: 'Average Task XP Daily',
    title: 'Average Task XP Per Day',
    canvasId: 'averageXpChart',
  },
  {
    name: 'cumulativeFocus',
    label: 'Cumulative Focus',
    title: 'Cumulative Focus Time (minutes)',
    canvasId: 'cumulativeFocusChart',
  },
  {
    name: 'dailyFocus',
    label: 'Daily Focus',
    title: 'Daily Focus Time (minutes)',
    canvasId: 'dailyFocusChart',
  },
] as const;

type TabName = (typeof TABS)[number]['name'];

export default function Growth() {
  useDocumentTitle('Growth');
  const { username } = useAuth();

  const [tab, setTab] = useState<TabName>('cumulative');
  const [data, setData] = useState<ChartData>(() => emptyChartData());
  const [placeholder, setPlaceholder] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Bumped to replay the entrance: on the first arrival of data, and whenever
   * a tab is chosen. Not on the refresh below — a chart re-growing every half
   * minute would be a tic, not an entrance.
   */
  const [playToken, setPlayToken] = useState(0);
  const hadData = useRef(false);

  const load = useCallback(
    async (quiet = false) => {
      if (!username) {
        setLoading(false);
        setError('Sign in to see your growth.');
        return;
      }
      if (!quiet) setLoading(true);
      const result = await growthService.series(username);
      if (result.success) {
        setData(processData(result.growth_data));
        // An account under three days old has nothing worth plotting yet.
        setPlaceholder(
          typeof result.days_since_creation === 'number' &&
            result.days_since_creation < 3,
        );
        setError(null);
        if (!hadData.current) {
          hadData.current = true;
          setPlayToken((n) => n + 1);
        }
      } else {
        setError(result.message);
        // The original fell back to a flat seven days rather than an empty box.
        setData(processData([]));
      }
      setLoading(false);
    },
    [username],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const timer = setInterval(() => void load(true), REFRESH_MS);
    // A tab coming back into view has missed however many refreshes.
    const onVisible = () => {
      if (!document.hidden) void load(true);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [load]);

  const choose = useCallback((name: TabName) => {
    setTab(name);
    setPlayToken((n) => n + 1);
  }, []);

  if (loading) return <Loading label="Loading your growth" />;
  if (error && !hadData.current) {
    return <ErrorState message={error} onRetry={() => void load()} />;
  }

  const active = TABS.find((t) => t.name === tab) ?? TABS[0];

  return (
    <div className="growth-container">
      <div
        className="growth-card page-shell"
        id="growthCard"
        data-fit-shrink-height
      >
        <div className="card-header">
          <h1>Growth Analytics</h1>
        </div>

        <div className="tab-navigation">
          {TABS.map((t) => (
            <button
              key={t.name}
              type="button"
              className={`tab-btn${t.name === tab ? ' active' : ''}`}
              id={`${t.name}-tab`}
              onClick={() => choose(t.name)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="tab-content">
          <div className="tab-pane active" id={`${active.name}-content`}>
            {/* `fade-in` is keyed on the tab so choosing one restarts the
                animation — the original forced a reflow to the same end. */}
            <div className="chart-container fade-in" key={active.name}>
              <h2 className="chart-title">{active.title}</h2>
              <GrowthChart
                id={active.canvasId}
                type={TAB_TO_TYPE[active.name] ?? 'cumulative'}
                data={data}
                placeholder={placeholder}
                playToken={playToken}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
