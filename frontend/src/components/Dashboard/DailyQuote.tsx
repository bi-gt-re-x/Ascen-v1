/**
 * The line at the foot of the dashboard.
 *
 * It renders a quote immediately and replaces it when the fetch lands, rather
 * than rendering nothing and waiting. The quote is the least important thing
 * on the page — a spinner where a line of text should be, or a footer that
 * pops into existence a second late and shifts the page under the reader, both
 * cost more than they buy. So the built-in line is the first paint and the
 * fetched one is an improvement on it.
 *
 * The markup keeps `.quote-container` and `#dailyQuote` because the easter egg
 * in frontend/secret/easter-egg.js is written against exactly those, and the
 * slide-out animation it drives lives in styles/dashboard.css under that id.
 * Same reason for `window.__mysteriousQuoteActive`: once the hidden chain has
 * been unlocked, the egg owns this line and the daily fetch must not overwrite
 * what it put there. That contract predates the React port and is kept so the
 * egg still works when it is ported.
 */
import { useEffect, useState } from 'react';
import { quote as quoteService } from '@/services';

/** Shown on first paint, and if the call never lands. */
const PLACEHOLDER = {
  quote: 'The secret of getting ahead is getting started.',
  author: 'Mark Twain',
};

declare global {
  interface Window {
    /** Set by the easter egg while it owns the quote line. */
    __mysteriousQuoteActive?: boolean;
  }
}

export function DailyQuote() {
  const [line, setLine] = useState(PLACEHOLDER);

  useEffect(() => {
    let live = true;

    void quoteService
      .daily()
      .then((result) => {
        // `live` guards a fetch that lands after the page has moved on;
        // `__mysteriousQuoteActive` guards one that lands after the egg has
        // claimed the line.
        if (!live || window.__mysteriousQuoteActive) return;
        if (!result.success || !result.quote) return;
        setLine({ quote: result.quote, author: result.author });
      })
      .catch(() => {
        /* offline: the placeholder is already on screen and is the fallback */
      });

    return () => {
      live = false;
    };
  }, []);

  return (
    <div className="quote-container">
      <p id="dailyQuote">
        &ldquo;{line.quote}&rdquo; - {line.author}
      </p>
    </div>
  );
}
