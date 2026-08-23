# tree_icons

The skill tree's own icons, kept apart from the 134 drawings in `utils/icons/`
above it. Those are the calendar's vocabulary — *gym*, *coffee*, *birthday* —
guessed from the name of a block a person typed. These are a curriculum's
vocabulary: *recursion*, *hash-map*, *integrals*, *ear-training*. A skill tree
that reached into the calendar's set would be picking `code.svg` for eleven
different programming nodes, which is how a lattice ends up looking like one
repeated square.

Served at `/static/icons/tree_icons/<name>.svg` — see `STATIC_ROOTS` in
[backend/config/settings.py](../../../backend/config/settings.py), which mounts
`utils/icons` at `/static/icons`, this folder included.

## The drawings

24×24, `fill="none"`, `stroke="currentColor"`, `stroke-width="2"`, round caps
and joins — the same construction as the icons a level up, so the two sets sit
beside each other without one looking heavier than the other.

## They are masks, not images

`currentColor` in a file loaded through `<img>` resolves to nothing useful, so
these are painted as a **CSS mask**: the alpha is the shape and the colour comes
from whatever the element has already decided. That is what lets one file be
grey on a locked node, green on a mastered one and violet in the detail panel
without a second copy of the drawing existing.

    .stx-ico { background: currentColor;
               mask: var(--ico) center / contain no-repeat; }

with the caller setting `style={{ '--ico': "url(/static/icons/tree_icons/…)" }}`.
`.cal-ico` in `frontend/src/styles/layout.css` is the same mechanism at the
calendar's size, and the note there explains why it is structural rather than a
colour decision.

## What is in here

| Group | Icons |
| --- | --- |
| Language | variables, types, conditionals, loops, functions, objects, arrays, strings, recursion, debugging, version-control, terminal, memory, pointers, compile, syntax |
| Data structures | linked-list, stack, queue, hash-map, tree-structure, graph-nodes, sorting, searching, binary-search, traversal, dynamic-programming, greedy, complexity |
| Web | html, css, layout, dom, http, api, client-state, components, routing, auth, deploy, responsive, browser, form |
| Systems | process, threads, concurrency, filesystem, network, database, server, cache, security, kernel, cloud, package |
| Mathematics | arithmetic, fractions, algebra-x, geometry, functions-graph, trigonometry, statistics, probability, calculus, derivatives, integrals, limits, matrices, vectors, series, equations |
| Music | rhythm, music-note, scales, intervals, chords, key-signature, progressions, ear-training, metronome, staff |
| Science | scientific-method, measurement, physics, chemistry, biology, energy, cells, atoms, forces, experiment, microscope, dna |
| State & chrome | locked, unlocked, mastered, in-progress, available, star, trophy, target, milestone, branch, path-route, map, compass, book, idea, brain, rocket, flag, gem, shield, spark, layers, puzzle, checklist, timer, streak, graduation, practice, xp-bolt, core-skill |

The last group is the one to reach into when a tree needs a node that is about
progress rather than about a subject — a milestone, a capstone, a review — and
the first seven are the subjects themselves. A node names its icon by filename
without the extension; `frontend/src/skills/subjectTrees.ts` is where those
names are attached, and anything it asks for that is missing falls back to
`core-skill`.

Adding one: drop a 24×24 stroke SVG in here and name it after the idea rather
than the drawing (`recursion`, not `nested-squares`), so the tree that wants it
can be read without opening the file.
