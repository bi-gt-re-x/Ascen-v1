/**
 * The small Markdown the notes page reads back.
 *
 * ## Why a subset, and why written here
 *
 * The notes toolbar writes Markdown into a plain-text column (see
 * pages/Notes.tsx) — which keeps a note readable as itself, in the database
 * and in any other window it is ever opened in. The cost of that choice is
 * that something has to turn it back into headings, and this is that
 * something.
 *
 * It covers exactly what the toolbar can write and nothing else. A general
 * Markdown library is tens of kilobytes to render six constructs, and every
 * one it adds beyond them is a construct the toolbar gives nobody a way to
 * produce.
 *
 * ## Escaping comes first, always
 *
 * A note body is text the account typed, and it is about to become innerHTML.
 * So `escape` runs over the whole string before a single rule does, and every
 * rule after it emits its own tags into already-safe text. Getting that order
 * wrong is the difference between a renderer and an XSS hole, which is why it
 * is one call at the top of `render` rather than a step each rule remembers.
 *
 * Link targets are the one place escaping is not enough: `javascript:` in an
 * `[a](b)` is still a script after the angle brackets are gone. `_href` allows
 * http, https, mailto and same-page anchors, and drops everything else.
 */

const ESCAPES: Array<[RegExp, string]> = [
  [/&/g, '&amp;'],
  [/</g, '&lt;'],
  [/>/g, '&gt;'],
  [/"/g, '&quot;'],
];

export function escape(text: string): string {
  return ESCAPES.reduce((out, [pattern, to]) => out.replace(pattern, to), text);
}

/** A link target, or '' for one that is not allowed. See the docstring. */
function _href(raw: string): string {
  const url = raw.trim();
  return /^(https?:\/\/|mailto:|#|\/)/i.test(url) ? url : '';
}

/**
 * Where a stretch of code is parked while the other marks are applied.
 *
 * A control character, so it cannot appear in a note: anything the account can
 * actually type would let them collide with the placeholder on purpose.
 */
const HOLD = '\u0000';

/**
 * The marks that live inside a line: bold, italic, underline, code, links.
 *
 * Code is taken first and its content is not re-scanned, so `**x**` inside
 * backticks stays as it was typed — the one nesting rule that actually comes
 * up when somebody writes about writing.
 */
function inline(text: string): string {
  const code: string[] = [];
  let out = text.replace(/`([^`]+)`/g, (_whole, held: string) => {
    code.push(held);
    return `${HOLD}${code.length - 1}${HOLD}`;
  });

  out = out
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_]+)__/g, '<u>$1</u>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (whole, label: string, target: string) => {
      const href = _href(target);
      return href
        ? `<a href="${href}" target="_blank" rel="noreferrer noopener">${label}</a>`
        : whole;
    });

  const holder = new RegExp(`${HOLD}(\\d+)${HOLD}`, 'g');
  return out.replace(holder, (_whole, index: string) => `<code>${code[Number(index)]}</code>`);
}

/** One list item's text, with a checkbox in front of it when it had one. */
function item(text: string): string {
  const box = /^\[([ xX])\]\s+/.exec(text);
  if (!box) return inline(text);
  const ticked = box[1]!.toLowerCase() === 'x';
  return (
    `<span class="md-box${ticked ? ' is-on' : ''}" aria-hidden="true"></span>` +
    `<span${ticked ? ' class="md-done"' : ''}>${inline(text.slice(box[0].length))}</span>`
  );
}

/**
 * Markdown to HTML, for the notes preview.
 *
 * Walks the lines once and keeps one piece of state — which block is open —
 * because every construct here is a line-level one, and a parser that builds a
 * tree for six rules is a parser nobody can read.
 */
export function render(source: string): string {
  const safe = escape(source);
  const out: string[] = [];
  /** The open block, so it can be closed before the next one opens. */
  let open: 'ul' | 'ol' | 'pre' | null = null;

  const shut = () => {
    if (open) out.push(`</${open}>`);
    open = null;
  };

  for (const line of safe.split('\n')) {
    // A fence swallows everything until the next one, formatting nothing.
    if (/^```/.test(line.trim())) {
      if (open === 'pre') {
        shut();
      } else {
        shut();
        out.push('<pre>');
        open = 'pre';
      }
      continue;
    }
    if (open === 'pre') {
      out.push(line);
      continue;
    }

    if (line.trim() === '') {
      shut();
      continue;
    }

    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      shut();
      const level = heading[1]!.length;
      out.push(`<h${level}>${inline(heading[2]!)}</h${level}>`);
      continue;
    }

    const quote = /^&gt;\s?(.*)$/.exec(line);
    if (quote) {
      shut();
      out.push(`<blockquote>${inline(quote[1]!)}</blockquote>`);
      continue;
    }

    const bullet = /^[-*]\s+(.*)$/.exec(line);
    if (bullet) {
      if (open !== 'ul') {
        shut();
        out.push('<ul>');
        open = 'ul';
      }
      out.push(`<li>${item(bullet[1]!)}</li>`);
      continue;
    }

    const numbered = /^\d+[.)]\s+(.*)$/.exec(line);
    if (numbered) {
      if (open !== 'ol') {
        shut();
        out.push('<ol>');
        open = 'ol';
      }
      out.push(`<li>${inline(numbered[1]!)}</li>`);
      continue;
    }

    shut();
    out.push(`<p>${inline(line)}</p>`);
  }

  shut();
  return out.join('\n');
}
