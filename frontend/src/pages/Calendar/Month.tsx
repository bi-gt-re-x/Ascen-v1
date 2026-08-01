/**
 * The Month view — being ported.
 *
 * A month of squares, each showing that day’s work and XP.
 *
 * All three views read the same data (backend/api/calendar.py) and differ only
 * in how they lay it out, so what is shared between them lives in
 * src/components/Calendar/ rather than being written three times.
 *
 * Porting from: frontend/js/calendar/calendar-month.js (4,700 lines)
 */
import { DateNav, ViewSwitcher } from '@/components/Calendar';
import { NotBuilt } from '@/components';
import { useDocumentTitle } from '@/hooks';
import { useState } from 'react';
import { dates } from '@/utils';
import '@/styles/calendar/month.css';

export default function Month() {
  useDocumentTitle('Calendar · Month');
  const [cursor, setCursor] = useState(() => new Date());

  return (
    <div className="calendar-page">
      <header className="calendar-header">
        <DateNav
          label={dates.formatDate(cursor, { dateStyle: 'full' })}
          unit="month"
          onPrevious={() => setCursor((d) => dates.addDays(d, -30))}
          onNext={() => setCursor((d) => dates.addDays(d, 30))}
          onToday={() => setCursor(new Date())}
        />
        <ViewSwitcher />
      </header>

      <NotBuilt
        name="Calendar · Month"
        description="A month of squares, each showing that day’s work and XP. Still served by the original page at /calendar — this is the React port, not written yet."
        files={['frontend/js/calendar/calendar-month.js (4,700 lines)', 'frontend/src/styles/calendar/month.css']}
      />
    </div>
  );
}
