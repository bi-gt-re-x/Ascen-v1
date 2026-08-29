/**
 * The renderer, at the edges where a note body meets innerHTML.
 *
 * Two kinds of assertion here and they are not the same kind of important.
 * The formatting ones say the toolbar's output reads back the way it was
 * written. The escaping and token ones say a note cannot write script or its
 * own CSS classes — those are the reason this file exists, and they are the
 * ones to look at first when something below starts failing.
 */
import { describe, expect, it } from 'vitest';
import { render } from './markdown';

describe('escaping', () => {
  it('escapes before any rule runs, so a note cannot emit tags', () => {
    expect(render('<script>alert(1)</script>')).toBe(
      '<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>',
    );
  });

  it('drops a javascript: link target and leaves the text', () => {
    expect(render('[x](javascript:alert(1))')).toContain('[x](javascript:alert(1))');
    expect(render('[x](javascript:alert(1))')).not.toContain('<a');
  });

  it('keeps an http target', () => {
    expect(render('[x](https://a.example)')).toContain('href="https://a.example"');
  });
});

describe('attributed spans', () => {
  it('turns a known token into its one class', () => {
    expect(render('[hot]{red}')).toBe('<p><span class="md-c-red">hot</span></p>');
  });

  it('takes several tokens at once', () => {
    expect(render('[x]{red serif bg-yellow}')).toContain(
      'class="md-c-red md-f-serif md-b-yellow"',
    );
  });

  it('drops an unknown token rather than passing it through as a class', () => {
    const html = render('[x]{plaid}');
    expect(html).not.toContain('plaid"');
    expect(html).not.toContain('<span');
    // The words survive, so the reader can see what they mis-typed.
    expect(html).toBe('<p>[x]{plaid}</p>');
  });

  it('cannot break out of the class attribute', () => {
    // The word survives as text — it is inert there, and escaping has already
    // turned its quotes into entities. What must not happen is a span at all,
    // because every token was unknown, and an attribute the note wrote itself.
    const html = render('[x]{" onclick="evil}');
    expect(html).toBe('<p>[x]{&quot; onclick=&quot;evil}</p>');
    expect(html).not.toContain('<span');
  });

  it('does not read a link as a span, or a span as a link', () => {
    expect(render('[a](https://b.example)')).toContain('<a href');
    expect(render('[a]{blue}')).toContain('<span class="md-c-blue">');
  });
});

describe('inline marks', () => {
  it('strikes and highlights', () => {
    expect(render('~~gone~~')).toBe('<p><s>gone</s></p>');
    expect(render('==kept==')).toBe('<p><mark class="md-b-yellow">kept</mark></p>');
  });

  it('leaves marks inside code exactly as typed', () => {
    expect(render('`==x== ~~y~~`')).toBe('<p><code>==x== ~~y~~</code></p>');
  });
});

describe('line attributes', () => {
  it('aligns a paragraph and takes the braces out of the text', () => {
    expect(render('Middle {center}')).toBe('<p class="md-a-center">Middle</p>');
  });

  it('aligns a heading too', () => {
    expect(render('# Title {right}')).toBe('<h1 class="md-a-right">Title</h1>');
  });

  it('leaves an unknown attribute in the text', () => {
    expect(render('Middle {sideways}')).toBe('<p>Middle {sideways}</p>');
  });
});

describe('lists', () => {
  it('nests on indentation and closes back out in order', () => {
    expect(render('- a\n  - b\n- c')).toBe(
      '<ul>\n<li>a</li>\n<ul>\n<li>b</li>\n</ul>\n<li>c</li>\n</ul>',
    );
  });

  it('reads a tab as one level', () => {
    expect(render('- a\n\t- b')).toContain('<ul>\n<li>a</li>\n<ul>\n<li>b</li>');
  });

  it('gives an ordered list the type its marker asked for', () => {
    expect(render('1. one')).toContain('<ol type="1">');
    expect(render('a. one')).toContain('<ol type="a">');
    expect(render('i. one')).toContain('<ol type="i">');
    expect(render('I. one')).toContain('<ol type="I">');
    expect(render('A. one')).toContain('<ol type="A">');
  });

  it('starts a second list when the kind changes at the same depth', () => {
    const html = render('- a\n1. b');
    expect(html).toBe('<ul>\n<li>a</li>\n</ul>\n<ol type="1">\n<li>b</li>\n</ol>');
  });

  it('closes every open list at a blank line', () => {
    expect(render('- a\n  - b\n\nafter')).toBe(
      '<ul>\n<li>a</li>\n<ul>\n<li>b</li>\n</ul>\n</ul>\n<p>after</p>',
    );
  });

  it('still draws a checklist box', () => {
    expect(render('- [x] done')).toContain('md-box is-on');
  });
});

describe('blocks', () => {
  it('reads a fourth heading level', () => {
    expect(render('#### Four')).toBe('<h4>Four</h4>');
  });

  it('draws a rule', () => {
    expect(render('---')).toBe('<hr />');
    expect(render('***')).toBe('<hr />');
  });

  it('does not read a two-item bullet line as a rule', () => {
    expect(render('- a')).toContain('<li>a</li>');
  });

  it('closes a fence left open at the end of the note', () => {
    expect(render('```\nx')).toBe('<pre>\nx\n</pre>');
  });
});
