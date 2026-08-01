/**
 * The Day view — being ported.
 *
 * One day, hour by hour, with its focus note.
 *
 * All three views read the same data (backend/api/calendar.py) and differ only
 * in how they lay it out, so what is shared between them lives in
 * src/components/Calendar/ rather than being written three times.
 *
 * Porting from: frontend/js/calendar/calendar-day.js
 */
import { DateNav, ViewSwitcher } from '@/components/Calendar';
import { NotBuilt } from '@/components';
import { useDocumentTitle } from '@/hooks';
import { useState } from 'react';
import { dates } from '@/utils';
import '@/styles/calendar/day.css';

export default function Day() {
  useDocumentTitle('Calendar · Day');
  const [cursor, setCursor] = useState(() => new Date());

  return (
    <div className="calendar-page">
      <header className="calendar-header">
        <DateNav
          label={dates.formatDate(cursor, { dateStyle: 'full' })}
          unit="day"
          onPrevious={() => setCursor((d) => dates.addDays(d, -1))}
          onNext={() => setCursor((d) => dates.addDays(d, 1))}
          onToday={() => setCursor(new Date())}
        />
        <ViewSwitcher />
      </header>

      <NotBuilt
        name="Calendar · Day"
        description="One day, hour by hour, with its focus note. Still served by the original page at /calendar — this is the React port, not written yet."
        files={['frontend/js/calendar/calendar-day.js', 'frontend/src/styles/calendar/day.css']}
      />
    </div>
  );
}
