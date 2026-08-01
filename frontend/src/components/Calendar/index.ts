/**
 * Calendar pieces shared by the Day, Week and Month views.
 *
 * The views themselves are pages (src/pages/Calendar/); what lives here is
 * what all three need — the view switcher and the date stepper. The grids
 * themselves join them as each view is ported from
 * frontend/js/calendar/.
 */
export { DateNav } from './DateNav';
export type { DateNavProps } from './DateNav';
export { ViewSwitcher } from './ViewSwitcher';
