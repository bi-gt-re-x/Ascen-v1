/**
 * Hour / minute / AM-PM, the way the calendar's dialogs have always asked.
 *
 * Three selects rather than `<input type="time">` because the stylesheets
 * dress `.time-select`, and because minutes snap to five: the grid's own
 * drag-to-create snapped there too, so a dialog offering 07 would produce a
 * block that no drag could ever reproduce.
 *
 * The value is 24-hour "HH:MM", which is what the store keeps. An empty value
 * is a legitimate state — the dialog opens with "--" until a time is picked —
 * and is reported as ''.
 */
import { columnSpanMinutes } from '@/utils/calendarGrid';

export interface TimePickerProps {
  /** "HH:MM", or '' for nothing chosen yet. */
  value: string;
  onChange: (value: string) => void;
  /** Marks all three selects, for the "you have to fill this in" state. */
  invalid?: boolean;
  label: string;
  id: string;
}

const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1));
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));

interface Parts {
  hour: string;
  minute: string;
  suffix: 'AM' | 'PM';
}

function toParts(value: string): Parts {
  const [hours, minutes] = value.split(':').map(Number);
  if (value === '' || hours === undefined || Number.isNaN(hours)) {
    return { hour: '', minute: '', suffix: 'AM' };
  }
  return {
    hour: String(hours % 12 || 12),
    minute: String(minutes ?? 0).padStart(2, '0'),
    suffix: hours >= 12 ? 'PM' : 'AM',
  };
}

function fromParts({ hour, minute, suffix }: Parts): string {
  if (!hour) return '';
  let hours = Number(hour);
  if (suffix === 'PM' && hours !== 12) hours += 12;
  if (suffix === 'AM' && hours === 12) hours = 0;
  return `${String(hours).padStart(2, '0')}:${minute || '00'}`;
}

export function TimePicker({ value, onChange, invalid, label, id }: TimePickerProps) {
  const parts = toParts(value);
  const set = (patch: Partial<Parts>) => onChange(fromParts({ ...parts, ...patch }));
  const invalidClass = invalid ? ' invalid-input' : '';

  return (
    <div className="form-group">
      <label htmlFor={`${id}Hour`}>{label}</label>
      <div className="time-selector">
        <select
          id={`${id}Hour`}
          className={`time-select${invalidClass}`}
          value={parts.hour}
          onChange={(event) => set({ hour: event.target.value })}
        >
          <option value="">--</option>
          {HOURS.map((hour) => (
            <option key={hour} value={hour}>
              {hour}
            </option>
          ))}
        </select>
        <select
          id={`${id}Minute`}
          className={`time-select${invalidClass}`}
          value={parts.minute}
          onChange={(event) => set({ minute: event.target.value })}
        >
          <option value="">--</option>
          {MINUTES.map((minute) => (
            <option key={minute} value={minute}>
              {minute}
            </option>
          ))}
        </select>
        <select
          id={`${id}AmPm`}
          className="time-select"
          value={parts.suffix}
          onChange={(event) => set({ suffix: event.target.value as 'AM' | 'PM' })}
        >
          <option value="AM">AM</option>
          <option value="PM">PM</option>
        </select>
      </div>
    </div>
  );
}

/** Minutes past midnight as "HH:MM" — what drag-to-create and the day view pass. */
export function minutesToTime(minutes: number): string {
  const total = ((Math.round(minutes / 5) * 5) % 1440 + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/**
 * How long a span is, in minutes, read down the calendar's column.
 *
 * Delegates to `columnSpanMinutes`, which is where the rule lives — a day on
 * this grid runs 6 AM to 5 AM, so 23:00 to 05:00 is a six-hour block on one
 * day and not a negative one. This used to subtract minutes past midnight
 * directly, which made every overnight span negative and got it refused.
 *
 * Still zero or negative for a span that genuinely does not fit on the day, so
 * the callers that use it as a validity test do not need to change.
 */
export function spanMinutes(start: string, end: string): number {
  return columnSpanMinutes(start, end);
}
