/**
 * The toolbar, and the label that made it look absent.
 *
 * "The font selector is literally gone" was reported about a control that was
 * in the DOM the whole time: it read "Font" before you pressed it and "Font"
 * after, so pressing it and picking a face was indistinguishable from pressing
 * a dead button. The first test says the control renders; the rest say the
 * label tracks the text, which is the part that was actually broken.
 */
import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';

vi.mock('@/services', async (original) => {
  const real = await original<Record<string, unknown>>();
  return {
    ...real,
    notes: {
      list: () => Promise.resolve({ success: true, notes: [] }),
      save: () => Promise.resolve({ success: true }),
      remove: () => Promise.resolve({ success: true }),
    },
  };
});

import Notes, { tokensAt } from './Notes';

describe('the notes toolbar', () => {
  it('draws a font and a size selector', async () => {
    renderWithProviders(<Notes />);
    expect(await screen.findByLabelText('Font')).toBeInTheDocument();
    expect(await screen.findByLabelText('Font size')).toBeInTheDocument();
  });

  it('opens on the note defaults, so the labels are never blank', async () => {
    renderWithProviders(<Notes />);
    expect(await screen.findByLabelText('Font')).toHaveTextContent('Inter');
    expect(await screen.findByLabelText('Font size')).toHaveTextContent('14');
  });
});

describe('tokensAt', () => {
  const body = 'plain [marked]{serif s24} plain';
  //            0123456
  const inside = body.indexOf('marked') + 2;

  it('reads the tokens of the span the caret is in', () => {
    expect(tokensAt(body, inside)).toEqual(['serif', 's24']);
  });

  it('reads nothing outside one', () => {
    expect(tokensAt(body, 2)).toEqual([]);
    expect(tokensAt(body, body.length)).toEqual([]);
  });

  it('treats the caret against the opening bracket as outside', () => {
    // That position is where the next character typed lands, and it lands
    // before the span rather than in it.
    expect(tokensAt(body, body.indexOf('['))).toEqual([]);
  });

  it('is case- and separator-insensitive, the way the renderer is', () => {
    expect(tokensAt('[x]{ SERIF ,  S24 }', 2)).toEqual(['serif', 's24']);
  });

  it('picks the span the caret is in when there are several', () => {
    const two = '[a]{red} and [b]{blue}';
    expect(tokensAt(two, two.indexOf('b') + 1)).toEqual(['blue']);
  });

  it('does not read a link as a span', () => {
    expect(tokensAt('[label](https://x.example)', 3)).toEqual([]);
  });
});
