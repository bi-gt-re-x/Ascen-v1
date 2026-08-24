/**
 * The progression arithmetic, checked rather than argued about.
 *
 *     node scripts/check_steps.mjs
 *     npm run check:steps
 *
 * Two modules decide how far along a skill is, and between them they hold every
 * rule that a reader can feel and nobody can see:
 *
 *   utils/skillSteps      what adding, deleting and editing a step does to the
 *                         list and to where the reader stands in it.
 *   utils/skillProgress   how that becomes a percentage, an XP figure and a
 *                         status on the graph the whole page reads.
 *
 * All of it is off-by-one arithmetic on an index into a list, which is the kind
 * of code that is correct until the afternoon it is not, and wrong in a way
 * that looks like a rounding error rather than like a bug. The interesting
 * cases are the ones nobody clicks by accident: deleting the step you are
 * standing on, deleting the one behind it, emptying a field on a list of one,
 * a node the tree seeded as finished whose programme the reader has since
 * rewritten.
 *
 * Bundled with esbuild and imported, the same as check_trees, so this runs
 * against exactly the modules the app runs against.
 *
 * Exits non-zero and names the failures if anything is wrong.
 */
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = await mkdtemp(join(tmpdir(), 't-'));
const one = async (e, n) => { const o = join(dir, n + '.mjs');
  await build({ entryPoints: [join(root, e)], bundle: true, format: 'esm', platform: 'node', outfile: o, logLevel: 'silent', alias: { '@': join(root, 'frontend/src') } });
  return import(pathToFileURL(o).href); };
const S = await one('frontend/src/utils/skillSteps.ts', 'S');
const P = await one('frontend/src/utils/skillProgress.ts', 'P');
const st = await one('frontend/src/skills/subjectTrees.ts', 'st');

let fails = 0;
const is = (label, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++; console.log(`${ok ? '\x1b[32m ok \x1b[0m' : '\x1b[31mFAIL\x1b[0m'} ${label}  got ${JSON.stringify(got)}${ok ? '' : ` want ${JSON.stringify(want)}`}`); };

let p = { steps: ['a', 'b', 'c', 'd', 'e'], at: 2 };
is('5 steps, on 3 → 40%', S.planPercent(p), 40);

// add at the end: same place, longer list, figure falls
let added = S.addStep(p, 'f');
is('add at end → 6 steps, still on 3', [added.steps.length, added.at], [6, 2]);
is('add at end → 33%', S.planPercent(added), 33);

// delete one ahead: same place, shorter list, figure rises
let cut = S.removeStep(p, 4);
is('delete ahead → 4 steps, still on 3', [cut.steps.length, cut.at], [4, 2]);
is('delete ahead → 50%', S.planPercent(cut), 50);

// delete one behind: reader stays on the same step, which is now numbered lower
let back = S.removeStep(p, 0);
is('delete behind → still on step "c"', back.steps[back.at], 'c');
is('delete behind → 4 steps, on 2 → 25%', S.planPercent(back), 25);

is('cannot delete the last step', S.removeStep({ steps: ['only'], at: 0 }, 0).steps, ['only']);
is('blank edit deletes', S.editStep(p, 1, '   ').steps, ['a', 'c', 'd', 'e']);
is('blank edit on a single step keeps it', S.editStep({ steps: ['x'], at: 0 }, 0, ' ').steps, ['x']);
is('text is trimmed and squashed', S.editStep(p, 0, '  two   words  ').steps[0], 'two words');
is('over-long text is cut', S.editStep(p, 0, 'z'.repeat(400)).steps[0].length, S.STEP_MAX);
is('all done → 100%', S.planPercent({ steps: ['a', 'b'], at: 2 }), 100);
is('empty list → 0%, not NaN', S.planPercent({ steps: [], at: 3 }), 0);
is('cap on adding', S.addStep({ steps: Array(S.STEPS_MAX).fill('x'), at: 0 }, 'y').steps.length, S.STEPS_MAX);

// the graph agrees with the panel
const g = st.graphFromSubjectTree(st.subjectTreeById('coding'));
const node = g.nodes.find((n) => n.id === 'c.loops');
const withPlan = P.applyProgress(g, {}, { 'c.loops': { steps: ['a','b','c','d'], at: 1 } }).nodes.find((n) => n.id === 'c.loops');
is('graph percent follows the plan', withPlan.percent, 25);
is('graph XP back-filled from it', withPlan.have, Math.round(node.need * 0.25));
is('graph status follows too', withPlan.status, 'progress');
const done = P.applyProgress(g, {}, { 'c.loops': { steps: ['a','b'], at: 2 } }).nodes.find((n) => n.id === 'c.loops');
is('all steps done completes the node', done.status, 'complete');
const untouched = P.applyProgress(g, {}, {}).nodes.find((n) => n.id === 'c.loops');
is('a node with no plan is unaffected', untouched.percent, P.applyProgress(g, {}).nodes.find((n) => n.id === 'c.loops').percent);

// a seeded-complete node that the reader has given unfinished steps to
const seeded = g.nodes.find((n) => n.status === 'complete');
const reopened = P.applyProgress(g, {}, { [seeded.id]: { steps: ['a','b','c'], at: 1 } }).nodes.find((n) => n.id === seeded.id);
is(`a written programme can reopen ${seeded.id}`, reopened.status, 'progress');

console.log(fails === 0 ? '\n\x1b[32mall passed\x1b[0m' : `\n\x1b[31m${fails} failed\x1b[0m`);
await rm(dir, { recursive: true, force: true });
process.exit(fails === 0 ? 0 : 1);
