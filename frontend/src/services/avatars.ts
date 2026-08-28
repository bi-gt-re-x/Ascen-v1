/**
 * The fifty profile pictures.
 *
 * A copy of AVATARS in backend/tracking/avatar.py, and **the order matters**:
 * an account that has never picked one is given a picture derived from its id
 * by indexing into this list, so re-ordering it would hand every such account a
 * different face. Add new ones at the end, in both places.
 *
 * Held here rather than fetched because the server-rendered version had all
 * fifty inline so the picker opens instantly, and there is no reason for the
 * React one to be slower.
 */
export const AVATARS = [
  'alien', 'astronaut', 'backpack', 'balloon', 'bear',
  'bee', 'book', 'bunny', 'cactus', 'camera',
  'cat', 'cloud', 'comet', 'cupcake', 'dog',
  'earth', 'elephant', 'fox', 'frog', 'guitar',
  'kite', 'koala', 'leaf', 'lion', 'moon',
  'mountain', 'mushroom', 'owl', 'palette', 'palm',
  'panda', 'pencil', 'penguin', 'rainbow', 'robot',
  'rocket', 'satellite', 'saturn', 'snowflake', 'sprout',
  'star', 'sun', 'sunflower', 'telescope', 'tree',
  'turtle', 'ufo', 'volcano', 'wave', 'whale',
] as const;

export type AvatarName = (typeof AVATARS)[number];

/** What a page shows when there is no account at all. */
export const FALLBACK_AVATAR: AvatarName = 'star';

/** Where the drawing lives. Served by the backend out of utils/images/. */
export function avatarPath(name: string): string {
  return `/static/images/avatars/${name}.svg`;
}

