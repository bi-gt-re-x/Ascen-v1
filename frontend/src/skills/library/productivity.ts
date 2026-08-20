/**
 * Productivity — the habits Ascen itself is built around.
 *
 * Small on purpose. These are the nodes most likely to appear as a supporting
 * branch in somebody else's tree — `productivity.deliberate-practice` belongs in
 * a violin path and a competitive-programming path equally — which is exactly
 * the cross-domain reuse the shared library is for.
 */
import { defineDomain } from './define';
import { after, all, threshold } from '../types';

const node = defineDomain({ category: 'Productivity', subcategory: 'Habits' });

export const productivity = [
  node({
    id: 'productivity.capture',
    name: 'Capturing Tasks',
    description: 'Getting it out of your head and into one place you actually look at.',
    difficulty: 'foundation',
    xpReward: 40,
    tags: ['productivity', 'habits', 'foundations'],
    hours: [1, 2],
    skillType: 'practice',
  }),
  node({
    id: 'productivity.prioritisation',
    name: 'Prioritisation',
    description: 'Deciding what not to do today, which is the only part that is hard.',
    difficulty: 'beginner',
    xpReward: 65,
    prerequisites: after('productivity.capture'),
    tags: ['productivity', 'planning'],
    hours: [2, 5],
    skillType: 'technique',
  }),
  node({
    id: 'productivity.time-blocking',
    name: 'Time Blocking',
    description: 'Giving work a slot in the day rather than a place on a list.',
    difficulty: 'beginner',
    xpReward: 70,
    prerequisites: after('productivity.prioritisation'),
    subcategory: 'Planning',
    tags: ['productivity', 'planning'],
    hours: [2, 6],
    skillType: 'technique',
  }),
  node({
    id: 'productivity.deep-work',
    name: 'Deep Work',
    description: 'Long uninterrupted stretches, and the arrangements that make them possible more than once.',
    difficulty: 'intermediate',
    xpReward: 110,
    prerequisites: all('productivity.time-blocking', 'productivity.prioritisation'),
    subcategory: 'Focus',
    tags: ['productivity', 'focus'],
    hours: [5, 20],
    skillType: 'practice',
  }),
  node({
    id: 'productivity.deliberate-practice',
    name: 'Deliberate Practice',
    description: 'Working at the edge of what you can do, with feedback, rather than repeating what you already have.',
    difficulty: 'advanced',
    xpReward: 160,
    prerequisites: after('productivity.deep-work'),
    subcategory: 'Focus',
    tags: ['productivity', 'learning', 'practice'],
    hours: [5, 20],
    skillType: 'concept',
  }),
  node({
    id: 'productivity.spaced-repetition',
    name: 'Spaced Repetition',
    description: 'Reviewing just before you would have forgotten, which is far less work than relearning.',
    difficulty: 'intermediate',
    xpReward: 100,
    prerequisites: after('productivity.capture'),
    subcategory: 'Learning',
    tags: ['productivity', 'learning', 'memory'],
    hours: [2, 8],
    skillType: 'technique',
  }),
  node({
    id: 'productivity.note-taking',
    name: 'Note-Taking That Survives',
    description: 'Notes written so that a version of you six months from now can use them.',
    difficulty: 'beginner',
    xpReward: 70,
    prerequisites: after('productivity.capture'),
    subcategory: 'Learning',
    tags: ['productivity', 'learning', 'writing'],
    hours: [2, 6],
    skillType: 'practice',
  }),
  node({
    id: 'productivity.review',
    name: 'Weekly Review',
    description: 'Looking at the week you actually had before planning the one you want.',
    difficulty: 'intermediate',
    xpReward: 95,
    prerequisites: threshold(2, 'productivity.time-blocking', 'productivity.note-taking', 'productivity.prioritisation'),
    subcategory: 'Planning',
    tags: ['productivity', 'planning', 'reflection'],
    hours: [1, 3],
    skillType: 'practice',
  }),
  node({
    id: 'productivity.consistency',
    name: 'Consistency Over Intensity',
    description: 'Streaks beat sprints, and the systems that make a small daily amount survive a bad week.',
    difficulty: 'advanced',
    xpReward: 150,
    prerequisites: all('productivity.review', 'productivity.deep-work'),
    tags: ['productivity', 'habits'],
    hours: [10, 50],
    skillType: 'practice',
  }),
];
