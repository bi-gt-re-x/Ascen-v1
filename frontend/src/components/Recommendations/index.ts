/**
 * The Recommendations page's panels.
 *
 * The suggestions themselves are generated in utils/advice, which reads
 * utils/behaviour — the same functions the Insights page states its findings
 * from. These components only render what those two decided.
 */
export { AdviceCard, CategoryFilter, OutlookPanel, AlsoPanel, Caveat } from './Panels';
