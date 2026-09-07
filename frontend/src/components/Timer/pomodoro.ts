/**
 * The ten styles, and the arithmetic that walks a cycle through them.
 *
 * ## Why ten, and why these
 *
 * A pomodoro is one number — how long you sit before you stop — and the
 * twenty-five minutes everybody quotes is one person's answer from 1987. It is
 * a good answer for reading a chapter and a bad one for a proof or a piece of
 * music, where twenty-five minutes is roughly the point at which you have
 * finished remembering where you were. So the list below is not decoration: it
 * spans ten to ninety minutes, and the reason a reader is choosing is that
 * their work has a natural length and it is probably not 25.
 *
 * Each one is a real, named method rather than a slider position, because
 * "Ultradian" is a thing somebody can go and read about and "82 minutes" is
 * not. The `who` line is what the picker shows: it says when the style is
 * right, not what the numbers are — the numbers are already on the card.
 *
 * ## What a cycle is
 *
 * focus, break, focus, break, … and every `rounds` focus intervals, the break
 * is a long one. `rounds: 1` means there is no long break at all, which is
 * correct for the styles built around a single long sitting — DeskTime and the
 * ultradian rhythm are not four-round methods and pretending they are would
 * invent a structure their authors did not put there.
 *
 * ## Everything here is pure
 *
 * `next` takes a phase and gives back the phase after it. No clock, no state,
 * no storage — the page owns all three. That is what makes the cycle testable
 * without pretending to be a timer, and it is the same split the rest of the
 * app uses for its arithmetic.
 */

export type Phase = 'focus' | 'break' | 'long';

export interface Style {
  id: string;
  name: string;
  /** Minutes of work in one interval. */
  focus: number;
  /** Minutes of the ordinary break after one. */
  rest: number;
  /** Minutes of the long break, when the style has one. */
  long: number;
  /** Focus intervals before the long break. 1 means the style has none. */
  rounds: number;
  /** When this one is the right choice. Shown on the card. */
  who: string;
}

/**
 * Ten, shortest first, so the list reads as a scale rather than a menu.
 *
 * The order matters more than it looks: somebody who does not know which they
 * want is choosing by how long they can sit, and a list sorted by that answers
 * the question they actually have.
 */
export const STYLES: Style[] = [
  {
    id: 'gentle',
    name: 'Gentle',
    focus: 10,
    rest: 5,
    long: 15,
    rounds: 4,
    who: 'For a day you cannot get started on. Ten minutes is short enough to be worth beginning.',
  },
  {
    id: 'short-burst',
    name: 'Short Burst',
    focus: 15,
    rest: 3,
    long: 10,
    rounds: 4,
    who: 'Flashcards, drills, admin — work made of many small pieces you can put down between.',
  },
  {
    id: 'sprint',
    name: 'Sprint',
    focus: 20,
    rest: 10,
    long: 20,
    rounds: 3,
    who: 'A long break for a short sitting. Good when the work is tiring rather than long.',
  },
  {
    id: 'classic',
    name: 'Classic',
    focus: 25,
    rest: 5,
    long: 15,
    rounds: 4,
    who: 'The original, and still the right first answer if you have no reason to prefer another.',
  },
  {
    id: 'extended',
    name: 'Extended',
    focus: 30,
    rest: 5,
    long: 20,
    rounds: 4,
    who: 'Classic with room to finish a thought. Reading, revision, problem sets.',
  },
  {
    id: 'animedoro',
    name: 'Animedoro',
    focus: 40,
    rest: 20,
    long: 20,
    rounds: 1,
    who: 'Forty on, twenty off, and the twenty is genuinely off. Built for long evenings.',
  },
  {
    id: 'study-hall',
    name: 'Study Hall',
    focus: 45,
    rest: 15,
    long: 30,
    rounds: 2,
    who: 'A school period. Fits homework and lessons because that is the length they were written for.',
  },
  {
    id: 'deep-work',
    name: 'Deep Work',
    focus: 50,
    rest: 10,
    long: 30,
    rounds: 2,
    who: 'Long enough to get past the setting-up. Essays, proofs, code, practice.',
  },
  {
    id: 'desktime',
    name: 'DeskTime',
    focus: 52,
    rest: 17,
    long: 17,
    rounds: 1,
    who: 'The ratio from DeskTime’s study of its most productive users. Oddly specific, and it holds up.',
  },
  {
    id: 'ultradian',
    name: 'Ultradian',
    focus: 90,
    rest: 20,
    long: 20,
    rounds: 1,
    who: 'One full attention cycle. The longest here, and the one to stop treating as a default.',
  },
];

export const BY_ID: Record<string, Style> = Object.fromEntries(
  STYLES.map((style) => [style.id, style]),
);

export const DEFAULT_STYLE = 'classic';

/** The style with that id, or the default — never undefined. */
export function styleFor(id: string | null | undefined): Style {
  const found = id ? BY_ID[id] : undefined;
  // Falling back twice rather than asserting once: the id comes out of the
  // reader's storage and may have been written by a build whose list was
  // different, and a picker that throws on one is worse than a picker that
  // opens on the default. The last step only satisfies the type — the list is
  // a literal and DEFAULT_STYLE is in it.
  return found ?? BY_ID[DEFAULT_STYLE] ?? STYLES[0]!;
}

/** How many minutes a phase runs for, under a given style. */
export function lengthOf(style: Style, phase: Phase): number {
  if (phase === 'focus') return style.focus;
  if (phase === 'long') return style.long;
  return style.rest;
}

export interface Cycle {
  phase: Phase;
  /**
   * Focus intervals finished in this cycle, counting from zero.
   *
   * Reset by the long break rather than by the fourth focus interval, so the
   * count on screen reads "2 of 4" through the break that follows the second —
   * which is where somebody looks at it.
   */
  done: number;
}

/**
 * The phase after this one.
 *
 * Focus goes to a break, and the break is the long one when this was the last
 * round. A break goes back to focus. A style with `rounds: 1` never produces a
 * short break at all: its rest *is* its long one, and giving it both would put
 * a seventeen-minute and a seventeen-minute break in a row.
 */
export function next(style: Style, cycle: Cycle): Cycle {
  if (cycle.phase === 'focus') {
    const done = cycle.done + 1;
    if (done >= style.rounds) return { phase: 'long', done };
    return { phase: 'break', done };
  }
  // Coming out of either break: the long one starts the count again.
  return { phase: 'focus', done: cycle.phase === 'long' ? 0 : cycle.done };
}

/** A whole cycle's length in minutes — what the picker prints under the name. */
export function cycleMinutes(style: Style): number {
  return style.focus * style.rounds
    + style.rest * Math.max(0, style.rounds - 1)
    + style.long;
}

/**
 * How much of an hour of sitting is actually work, 0-100.
 *
 * The picker shows it because it is the one figure that compares ten styles
 * that are otherwise not comparable: Gentle and Ultradian differ by an hour and
 * twenty minutes per interval and are within nine points of each other here.
 */
export function focusShare(style: Style): number {
  const total = cycleMinutes(style);
  return total ? Math.round((style.focus * style.rounds) / total * 100) : 0;
}

/** mm:ss for a whole number of seconds, and h:mm:ss once it passes an hour. */
export function clock(seconds: number): string {
  const whole = Math.max(0, Math.round(seconds));
  const h = Math.floor(whole / 3600);
  const m = Math.floor((whole % 3600) / 60);
  const s = whole % 60;
  const pad = (n: number) => (n < 10 ? `0${n}` : String(n));
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

// --------------------------------------------------------------------------
// The wizard's one question
// --------------------------------------------------------------------------
/**
 * The three answers the setup asks for, and what they pick between.
 *
 * Deliberately one axis rather than a questionnaire: how long can you sit? Every
 * other property of these styles follows from that, so a second question would
 * be asking somebody to specify something they can only find out by trying it.
 */
export type Sitting = 'short' | 'medium' | 'long';

export const SITTINGS: { id: Sitting; label: string; hint: string }[] = [
  { id: 'short', label: 'Not long', hint: 'Ten to twenty minutes before I need to move.' },
  { id: 'medium', label: 'About half an hour', hint: 'Long enough to finish something, not a whole afternoon.' },
  { id: 'long', label: 'A long stretch', hint: 'I lose an hour without noticing when it is going well.' },
];

/** What the setup lands on for each answer. */
export const RECOMMENDED: Record<Sitting, string> = {
  short: 'short-burst',
  medium: 'classic',
  long: 'deep-work',
};

/**
 * The styles offered beside the recommendation, for that answer.
 *
 * Three each, and the recommendation is one of them: the wizard's last step is
 * a choice with a default rather than an announcement, because somebody who
 * knows they want Ultradian should not have to finish a wizard to say so.
 */
export const NEARBY: Record<Sitting, string[]> = {
  short: ['gentle', 'short-burst', 'sprint'],
  medium: ['classic', 'extended', 'animedoro'],
  long: ['study-hall', 'deep-work', 'ultradian'],
};
