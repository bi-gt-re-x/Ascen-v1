/**
 * The skill-tree data lint.
 *
 *     node scripts/check_trees.mjs
 *     npm run check:trees
 *
 * The trees in frontend/src/skills/trees are content — fifty-odd files of
 * authored prose, prerequisites and icon names, edited a subject at a time.
 * Content of that size acquires exactly four kinds of mistake, and every one of
 * them is silent in the browser:
 *
 *   - a `requires` naming a node that was renamed or lives on another tree.
 *     The layout drops the edge, the node quietly floats to the top rank, and
 *     nothing anywhere says so.
 *   - a node nothing can ever unlock, because everything above it is locked
 *     too. It renders perfectly and can never be reached by anybody.
 *   - a `navTo` pointing at a tree id that does not exist, or at one that does
 *     not name this tree as its parent. The diamond is drawn and the click goes
 *     nowhere, or goes somewhere with no way back.
 *   - an icon name with no file behind it. `iconUrl` falls back to `core-skill`,
 *     so the tile still draws — with the wrong drawing, indefinitely.
 *
 * None of these can be caught by TypeScript: every one of them is a string that
 * is correctly typed and wrong. So they are checked here instead, against the
 * real modules and the real icon folder.
 *
 * ## How it reads the trees
 *
 * esbuild bundles skills/trees/index.ts to a temporary module and the module is
 * imported. Nothing is parsed by hand: the check runs against exactly the data
 * the app runs against, so a tree that passes here cannot differ from the tree
 * that ships. The bundle is possible because skills/trees imports nothing at
 * runtime — the two imports it has are `import type`, and erase.
 *
 * Exits non-zero with a report if anything is wrong, and prints a summary of the
 * library if nothing is.
 */
import { build } from 'esbuild';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ICON_DIR = join(root, 'utils', 'icons', 'tree_icons');
const ENTRY = join(root, 'frontend', 'src', 'skills', 'trees', 'index.ts');

/* How small a tree is allowed to be before it stops being a lattice and starts
   being a list. Nothing enforces an upper bound: a subject is as big as it is. */
const MIN_NODES = 12;
/* A description that only expands the title tells a reader nothing. This is not
   a quality check — no length check is — but it does catch the placeholder that
   was going to be filled in later. */
const MIN_DESC = 80;

const problems = [];
const warnings = [];
const fail = (where, message) => problems.push(`${where}: ${message}`);
const warn = (where, message) => warnings.push(`${where}: ${message}`);

// ---------------------------------------------------------------------------
// Load
// ---------------------------------------------------------------------------
const dir = await mkdtemp(join(tmpdir(), 'ascen-trees-'));
const outfile = join(dir, 'trees.mjs');
let TREES;
try {
  await build({ entryPoints: [ENTRY], bundle: true, format: 'esm', outfile, logLevel: 'warning' });
  ({ TREES } = await import(pathToFileURL(outfile).href));
} finally {
  await rm(dir, { recursive: true, force: true });
}

const icons = new Set(
  (await readdir(ICON_DIR)).filter((name) => name.endsWith('.svg')).map((name) => name.slice(0, -4)),
);

const byTreeId = new Map(TREES.map((tree) => [tree.id, tree]));
const iconsUsed = new Set();
const nodeOwner = new Map(); // node id → tree id, for the global uniqueness rule

// ---------------------------------------------------------------------------
// Structure
// ---------------------------------------------------------------------------
if (byTreeId.size !== TREES.length) fail('library', 'two trees share an id');

for (const tree of TREES) {
  const where = `tree ${tree.id}`;
  const nodes = new Map(tree.nodes.map((node) => [node.id, node]));

  if (nodes.size !== tree.nodes.length) fail(where, 'two nodes share an id');
  if (!tree.title || !tree.blurb) fail(where, 'needs a title and a blurb');
  if (tree.nodes.length < MIN_NODES) {
    fail(where, `${tree.nodes.length} nodes, fewer than the ${MIN_NODES} a lattice needs`);
  }

  if (tree.parent) {
    const parent = byTreeId.get(tree.parent);
    if (!parent) fail(where, `parent "${tree.parent}" is not a tree`);
    else if (!parent.nodes.some((node) => node.navTo === tree.id)) {
      fail(where, `no node on ${parent.id} opens it — the tree is unreachable`);
    }
  } else if (!tree.group) {
    fail(where, 'a root needs a group, so the switcher can file it');
  }

  // ---- per node ----
  const dependents = new Map(tree.nodes.map((node) => [node.id, 0]));
  for (const node of tree.nodes) {
    const at = `${where} / ${node.id}`;
    const previous = nodeOwner.get(node.id);
    if (previous) fail(at, `id also used on ${previous} — node ids are global`);
    nodeOwner.set(node.id, tree.id);

    if (!node.name) fail(at, 'has no name');
    if (!node.desc || node.desc.length < MIN_DESC) {
      fail(at, `description is ${node.desc?.length ?? 0} characters, under ${MIN_DESC}`);
    }
    if (!node.icon) fail(at, 'has no icon');
    else {
      iconsUsed.add(node.icon);
      if (!icons.has(node.icon)) fail(at, `icon "${node.icon}" has no file in utils/icons/tree_icons`);
    }

    for (const [kind, list] of [['requires', node.requires], ['recommends', node.recommends]]) {
      for (const id of list ?? []) {
        if (!nodes.has(id)) fail(at, `${kind} "${id}", which is not on this tree`);
        else if (kind === 'requires') dependents.set(id, (dependents.get(id) ?? 0) + 1);
      }
    }

    if (node.navTo) {
      const child = byTreeId.get(node.navTo);
      if (!child) fail(at, `opens "${node.navTo}", which is not a tree`);
      else if (child.parent !== tree.id) {
        fail(at, `opens ${child.id}, whose parent is ${child.parent ?? 'nobody'} rather than ${tree.id}`);
      }
      if (node.xp) fail(at, 'is a doorway and cannot be practised, so it must not carry XP');
    }
  }

  for (const node of tree.nodes) {
    if (node.navTo && (dependents.get(node.id) ?? 0) > 0) {
      fail(`${where} / ${node.id}`, 'is a doorway that something requires — it can never complete');
    }
  }

  // ---- cycles ----
  const colour = new Map();
  const walk = (id, trail) => {
    if (colour.get(id) === 'done') return;
    if (colour.get(id) === 'open') {
      fail(where, `prerequisite cycle: ${[...trail.slice(trail.indexOf(id)), id].join(' → ')}`);
      return;
    }
    colour.set(id, 'open');
    for (const next of nodes.get(id)?.requires ?? []) {
      if (nodes.has(next)) walk(next, [...trail, id]);
    }
    colour.set(id, 'done');
  };
  for (const node of tree.nodes) walk(node.id, []);

  // ---- can every node be reached? ----
  // The same rule utils/skillProgress applies: a node opens when the tree seeded
  // it open, or when everything it requires is complete. So a tree works if,
  // starting from what it seeded and finishing everything openable, the whole
  // lattice eventually opens. A tree that seeds nothing open is a tree nobody
  // can enter, and a node behind a doorway is a node nobody can reach.
  const open = new Set(tree.nodes.filter((node) => (node.state ?? 'locked') !== 'locked').map((n) => n.id));
  if (open.size === 0) fail(where, 'every node is locked — the tree cannot be started');
  const complete = new Set([...open].filter((id) => !nodes.get(id).navTo));
  for (;;) {
    let grew = false;
    for (const node of tree.nodes) {
      if (open.has(node.id)) continue;
      const gates = (node.requires ?? []).filter((id) => nodes.has(id));
      if (gates.length > 0 && gates.every((id) => complete.has(id))) {
        open.add(node.id);
        if (!node.navTo) complete.add(node.id);
        grew = true;
      }
    }
    if (!grew) break;
  }
  const stranded = tree.nodes.filter((node) => !open.has(node.id));
  if (stranded.length > 0) {
    fail(where, `unreachable however much is practised: ${stranded.map((n) => n.id).join(', ')}`);
  }

  // ---- is it actually a lattice? ----
  const tiers = new Set(tree.nodes.map((node) => node.tier));
  if (tiers.size < 3) fail(where, `only ${tiers.size} difficulty tier(s) — a ladder needs rungs`);
  const joins = tree.nodes.filter((node) => (node.requires ?? []).length > 1).length;
  const forks = [...dependents.values()].filter((count) => count > 1).length;
  if (joins === 0 || forks === 0) {
    fail(where, `${forks} fork(s) and ${joins} join(s) — a chain rather than a tree`);
  }
  if (!tree.nodes.some((node) => node.core)) warn(where, 'no node is marked as core');
}

// ---------------------------------------------------------------------------
// Reachability of the whole hierarchy, and the icon set
// ---------------------------------------------------------------------------
const reached = new Set(TREES.filter((tree) => !tree.parent).map((tree) => tree.id));
for (;;) {
  const before = reached.size;
  for (const tree of TREES) {
    if (!reached.has(tree.id)) continue;
    for (const node of tree.nodes) if (node.navTo) reached.add(node.navTo);
  }
  if (reached.size === before) break;
}
for (const tree of TREES) {
  if (!reached.has(tree.id)) fail(`tree ${tree.id}`, 'cannot be walked to from any root');
}

const unused = [...icons].filter((name) => !iconsUsed.has(name)).sort();

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
const nodeCount = TREES.reduce((total, tree) => total + tree.nodes.length, 0);
const roots = TREES.filter((tree) => !tree.parent);

if (problems.length > 0) {
  console.error(`\n${problems.length} problem(s) in the subject trees:\n`);
  for (const problem of problems) console.error(`  ✗ ${problem}`);
  console.error('');
  process.exit(1);
}

console.log(`\n${TREES.length} trees · ${roots.length} roots · ${nodeCount} nodes · ${iconsUsed.size} icons in use`);
for (const { group, trees } of groupRoots(roots)) {
  console.log(`  ${group}: ${trees.map((tree) => tree.title).join(', ')}`);
}
if (warnings.length > 0) {
  console.log('');
  for (const warning of warnings) console.log(`  · ${warning}`);
}
if (unused.length > 0) console.log(`\n${unused.length} icon(s) drawn but unused: ${unused.join(', ')}`);
console.log('\nEvery prerequisite resolves, every branch reaches a tree, every node has a drawing.\n');

function groupRoots(list) {
  const order = [];
  const byGroup = new Map();
  for (const tree of list) {
    const group = tree.group ?? 'Other';
    if (!byGroup.has(group)) {
      byGroup.set(group, []);
      order.push(group);
    }
    byGroup.get(group).push(tree);
  }
  return order.map((group) => ({ group, trees: byGroup.get(group) }));
}
