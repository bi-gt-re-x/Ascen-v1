/**
 * The subject → skill-tree routing table, copied to the backend.
 *
 *     node scripts/gen_tree_map.mjs            # write it
 *     node scripts/gen_tree_map.mjs --check    # fail if it is stale
 *     npm run check:trees                      # runs --check
 *
 * ## Why a generated file and not a second hand-written one
 *
 * Which lattice a subject opens is decided in frontend/src/skills/subjectMap.ts,
 * and it has to stay decided there: it is a hundred curated routes with node
 * targets on most of them, edited beside the trees themselves, and checked
 * against backend/config/subjects.py by scripts/check_trees.mjs.
 *
 * The achievements endpoint needs two facts out of it — which tree a subject
 * belongs to, and what a whole tree is worth — because a badge is counted on
 * the server from the account's own rows, and the server cannot ask the browser
 * which tree a task was on. Writing those two facts out by hand in Python would
 * be a second copy of a routing table that changes whenever a tree is added,
 * and the two would disagree the first time one of them was edited alone. The
 * disagreement would be silent: a subject missing from the Python copy simply
 * stops counting toward a badge, and nothing renders wrong.
 *
 * So the table is generated, and `--check` in the build fails if the generated
 * file is not what the source would produce. There is one authority; the copy
 * is a build artefact that happens to be committed so the backend can run
 * without Node.
 *
 * ## What a tree is "worth"
 *
 * The sum of its nodes' `xp`, skipping navigation nodes — a doorway into a
 * child tree is not a skill and cannot be held, so counting its worth would
 * charge a reader twice for the tree behind it.
 *
 * Node `state` and `percent` are NOT read, and must not be: they are authored
 * illustration, identical for every account (see the note in
 * frontend/src/skills/subjectTrees.ts). What varies per account is the XP that
 * account has actually filed under the subjects routing to a tree, which is
 * what backend/api/achievements.py measures against these totals.
 */
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import esbuild from 'esbuild';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const OUT = join(ROOT, 'backend', 'config', 'skill_trees.py');

async function load(entry) {
  const file = join(mkdtempSync(join(tmpdir(), 'treemap-')), 'bundle.mjs');
  await esbuild.build({
    entryPoints: [join(ROOT, entry)],
    bundle: true,
    format: 'esm',
    outfile: file,
    absWorkingDir: ROOT,
    alias: { '@': join(ROOT, 'frontend', 'src') },
    logLevel: 'silent',
  });
  return import(pathToFileURL(file).href);
}

const { SUBJECT_TARGETS } = await load('frontend/src/skills/subjectMap.ts');
const { SUBJECT_TREES } = await load('frontend/src/skills/subjectTrees.ts');

const worth = (tree) => tree.nodes
  .filter((node) => !node.navTo)
  .reduce((sum, node) => sum + (node.xp ?? 0), 0);

const py = (value) => `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

const subjects = Object.entries(SUBJECT_TARGETS)
  .map(([id, target]) => `    ${py(id)}: ${py(target.tree)},`)
  .join('\n');

const trees = SUBJECT_TREES
  .map((tree) => `    ${py(tree.id)}: (${py(tree.title)}, ${worth(tree)}),`)
  .join('\n');

const body = `"""Subject → skill tree, and what each tree is worth. GENERATED — do not edit.

Written by scripts/gen_tree_map.mjs from frontend/src/skills/subjectMap.ts and
frontend/src/skills/subjectTrees.ts, which are the authority. \`npm run
check:trees\` fails if this file is not what those two would produce, so editing
it here is a change that gets reverted by the next build rather than a change.

See the module note in scripts/gen_tree_map.mjs for why the copy exists at all:
badges are counted on the server from the account's own rows, and the server
cannot ask the browser which lattice a task was on.
"""

#: Catalogue subject id → the tree it opens. Every id in
#: backend/config/subjects.py appears here; scripts/check_trees.mjs is what
#: keeps that true.
SUBJECT_TREE = {
${subjects}
}

#: Tree id → (title, total XP of its holdable nodes).
#:
#: The total skips navigation nodes: a doorway into a child tree is not a skill
#: somebody holds, and counting its worth would charge them twice for the tree
#: behind it.
TREES = {
${trees}
}


def tree_for(subject):
    """The tree a subject opens, or None for one nothing routes.

    Unlike the client's \`treeForSubject\`, this does not fall back to the
    subject's group. A fallback is the right answer for a rail that has to put
    every subject *somewhere*; it is the wrong answer for a badge, where it
    would hand somebody credit in a lattice they have never opened because the
    subject they invented happened to land in Computing.
    """
    return SUBJECT_TREE.get(subject)
`;

if (process.argv.includes('--check')) {
  let existing = '';
  try {
    existing = readFileSync(OUT, 'utf8');
  } catch {
    existing = '';
  }
  if (existing !== body) {
    console.error(
      'backend/config/skill_trees.py is stale.\n'
      + '  The subject map or a tree changed and the generated copy did not.\n'
      + '  Run: node scripts/gen_tree_map.mjs',
    );
    process.exit(1);
  }
  console.log(`skill_trees.py matches ${Object.keys(SUBJECT_TARGETS).length} subjects`
    + ` across ${SUBJECT_TREES.length} trees.`);
} else {
  writeFileSync(OUT, body);
  console.log(`wrote backend/config/skill_trees.py —`
    + ` ${Object.keys(SUBJECT_TARGETS).length} subjects, ${SUBJECT_TREES.length} trees.`);
}
