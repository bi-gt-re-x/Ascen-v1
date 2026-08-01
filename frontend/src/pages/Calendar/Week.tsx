/**
 * The Week view — being ported.
 *
 * Seven days as columns, with drag-to-create and the weekly focus panel.
 *
 * All three views read the same data (backend/api/calendar.py) and differ only
 * in how they lay it out, so what is shared between them lives in
 * src/components/Calendar/ rather than being written three times.
 *
 * Porting from: frontend/js/calendar/calendar-week.js (3,010 lines)
 */
import { DateNav, ViewSwitcher } from '@/components/Calendar';
import { NotBuilt } from '@/components';
import { useDocumentTitle } from '@/hooks';
import { useState } from 'react';
import { dates } from '@/utils';
import '@/styles/calendar/week.css';

export default function Week() {
  useDocumentTitle('Calendar · Week');
  const [cursor, setCursor] = useState(() => new Date());

  return (
    <div className="calendar-page">
      <header className="calendar-header">
        <DateNav
          label={dates.formatDate(cursor, { dateStyle: 'full' })}
          unit="week"
          onPrevious={() => setCursor((d) => dates.addDays(d, -7))}
          onNext={() => setCursor((d) => dates.addDays(d, 7))}
          onToday={() => setCursor(new Date())}
        />
        <ViewSwitcher />
      </header>

      <NotBuilt
        name="Calendar · Week"
        description="Seven days as columns, with drag-to-create and the weekly focus panel. Still served by the original page at /calendar — this is the React port, not written yet."
        files={['frontend/js/calendar/calendar-week.js (3,010 lines)', 'frontend/src/styles/calendar/week.css']}
      />
    </div>
  );
}
