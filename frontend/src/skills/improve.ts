/**
 * How to get better at a node — the other half of what a skill *is*.
 *
 * Kept apart from skills/subjectTrees on purpose. That file answers "what is
 * this, where does it sit, what does it gate"; this one answers "what would you
 * actually go and do about it", which is a different kind of claim, changes for
 * different reasons, and is the part a reader is looking for once they have
 * decided to work on something. One node's entry can be rewritten without
 * touching the shape of any tree.
 *
 * ## Steps are things to do, not things to know
 *
 * Every line is an action with an object — "write a loop that walks a list
 * backwards", not "understand iteration". A panel of restatements of the node's
 * own description is what this file exists to avoid: the reader has just read
 * that sentence two inches above.
 *
 * ## Anything missing still gets an answer
 *
 * `improveSteps` falls back to advice built from what the graph already knows —
 * the node's name and what it opens. A tree that adds a node and forgets to add
 * its steps gets something useful rather than an empty heading, which is what
 * keeps this file from being a thing you must remember to update.
 */
import type { GraphNode } from '@/utils/skillGraph';

/** Node id → three or so concrete moves. */
export const IMPROVE: Record<string, string[]> = {
  // ---- Coding -----------------------------------------------------------
  'c.vars': [
    'Name ten values in a program you already wrote — badly named ones count double.',
    'Predict what each variable holds at three points, then print them and check.',
    'Rewrite a function so no name is reused for two different meanings.',
  ],
  'c.types': [
    'Take a working program and write down the type of every value in it.',
    'Deliberately add a number to a string and read the error properly.',
    'Convert between three type pairs by hand: text to number, number to text, anything to boolean.',
  ],
  'c.io': [
    'Write a program that asks two questions and answers using both.',
    'Handle the case where the person types nothing at all.',
    'Read a file line by line and print only the lines that match something.',
  ],
  'c.cond': [
    'Write a branch with three outcomes without nesting more than one deep.',
    'Find a condition in your own code and simplify it without changing what it does.',
    'Write the truth table for an && or || you found confusing, then test it.',
  ],
  'c.loops': [
    'Walk a list forwards, backwards, and every second item.',
    'Rewrite one loop as a while and one while as a loop.',
    'Write a loop that stops early, and prove it stops on the right item.',
  ],
  'c.fns': [
    'Take a forty-line block and cut it into three functions that each do one thing.',
    'Write a function with no side effects and one with only side effects; name the difference.',
    'Give a function a default argument and call it three ways.',
  ],
  'c.debug': [
    'Fix a bug using only prints, then fix the next one with a real debugger.',
    'Before each fix, write down what you think is wrong and check whether you were right.',
    'Reproduce a bug reliably before changing a single line.',
  ],
  'c.ds': [
    'Solve one problem with a list and again with a map; time both.',
    'Pick a structure for a real task and write one sentence on why not the others.',
    'Nest two structures — a map of lists — and walk it.',
  ],
  'c.oop': [
    'Turn a group of loose functions and a dict into one class.',
    'Write two classes where one uses the other rather than inheriting from it.',
    'Add a method that changes state, and one that only reports it.',
  ],
  'c.git': [
    'Make ten commits with messages that say why rather than what.',
    'Branch, make a change, and merge it back deliberately.',
    'Recover a change you deleted, without copying files by hand.',
  ],
  'c.err': [
    'Make a program fail on purpose three ways and handle each differently.',
    'Write one error message a stranger could act on.',
    'Find a place where you swallowed an error and make it say something.',
  ],

  // ---- Web --------------------------------------------------------------
  'w.html': [
    'Rebuild a page you like using only semantic tags — no div unless nothing else fits.',
    'Run a page through an accessibility checker and fix what it names.',
    'Write a form with labels that actually connect to their inputs.',
  ],
  'w.css': [
    'Recreate a component from a screenshot without inspecting it.',
    'Explain out loud why one rule beat another; check with the inspector.',
    'Replace three magic numbers with variables and reuse them.',
  ],
  'w.layout': [
    'Build the same layout twice: once with flexbox, once with grid.',
    'Make one layout survive from 320px to 1600px with no media query.',
    'Fix an overflow by finding what actually set the width.',
  ],
  'w.dom': [
    'Add, move and remove an element without reloading the page.',
    'Attach one listener to a parent and handle clicks on all its children.',
    'Read a value out of the page and write it back somewhere else.',
  ],
  'w.http': [
    'Fetch something real and print the status, headers and body separately.',
    'Handle a 404 and a network failure differently, on purpose.',
    'Send a POST with a body and read what came back.',
  ],
  'w.state': [
    'List everything one screen needs to know before writing any of it.',
    'Find state stored in two places and delete one of them.',
    'Make a loading, loaded and failed state all reachable.',
  ],
  'w.react': [
    'Split one large component into three that could be tested alone.',
    'Lift a piece of state up until exactly one component owns it.',
    'Give a list stable keys and watch what changes when you get them wrong.',
  ],
  'w.routing': [
    'Give every screen its own URL and check the back button on each.',
    'Make one route that reads a parameter out of the path.',
    'Paste a deep link into a fresh tab and confirm it lands right.',
  ],
  'w.apis': [
    'Render real data, including while it is still loading.',
    'Handle an empty result differently from a failed one.',
    'Cancel a request that is no longer needed.',
  ],
  'w.auth': [
    'Sign in, reload, and stay signed in.',
    'Make one route that a signed-out visitor cannot reach.',
    'Sign out and confirm nothing sensitive survives it.',
  ],
  'w.deploy': [
    'Put something on the internet that someone else can open.',
    'Break the build on purpose and read the failure.',
    'Change one thing and ship it again in under five minutes.',
  ],

  // ---- Algorithms -------------------------------------------------------
  'a.arrays': [
    'Implement index, insert and delete by hand and count the steps each takes.',
    'Solve three two-pointer problems.',
    'Explain why appending is usually cheap and inserting at the front is not.',
  ],
  'a.strings': [
    'Reverse, split and join without library help once, then never again.',
    'Solve an anagram and a palindrome problem.',
    'Find why building a string in a loop can be slow.',
  ],
  'a.linked': [
    'Build one from scratch and delete a node from the middle.',
    'Reverse it iteratively, then recursively.',
    'Detect a cycle without using extra memory.',
  ],
  'a.stacks': [
    'Check balanced brackets with a stack.',
    'Implement a queue out of two stacks.',
    'Name one real problem where the wrong one of the two makes it harder.',
  ],
  'a.hash': [
    'Count word frequencies in a paragraph.',
    'Write your own tiny hash map with buckets and collisions.',
    'Solve one problem that goes from n² to n by adding a map.',
  ],
  'a.recursion': [
    'Write the base case first, three times in a row.',
    'Draw the call stack for one small input, by hand.',
    'Convert one recursive function into a loop.',
  ],
  'a.trees': [
    'Walk one in all three orders and say what each is good for.',
    'Insert into and search a binary search tree.',
    'Compute depth and check whether it is balanced.',
  ],
  'a.sorting': [
    'Implement one n² sort and one n log n sort.',
    'Sort by two keys at once.',
    'Say when the built-in sort is the right answer — it usually is.',
  ],
  'a.searching': [
    'Write it once with no off-by-one error; test the empty and single cases.',
    'Search for an insertion point rather than an exact match.',
    'Binary search on an answer rather than on an array.',
  ],
  'a.complexity': [
    'Give the big-O of five functions you have already written.',
    'Find a loop inside a loop and say what makes it n².',
    'Time a real function at 10, 100 and 1000 inputs and see if it matches.',
  ],
  'a.dp': [
    'Solve one problem recursively, then add memoisation, then make it a table.',
    'Write the recurrence in words before writing any code.',
    'Do the classic three: fibonacci, coin change, longest common subsequence.',
  ],
  'a.greedy': [
    'Solve interval scheduling and prove the greedy choice is safe.',
    'Find one problem where greedy looks right and is wrong.',
    'Compare a greedy and a DP solution to the same problem.',
  ],

  // ---- Graphs -----------------------------------------------------------
  'g.repr': [
    'Build the same graph as a list and as a matrix.',
    'Say which one you would use for a sparse graph, and why.',
    'Load a graph from a text file.',
  ],
  'g.bfs': [
    'Find the shortest path in an unweighted maze.',
    'Track the path itself, not just the distance.',
    'Explain why a queue is what makes it level by level.',
  ],
  'g.dfs': [
    'Write it recursively and again with an explicit stack.',
    'Count connected components.',
    'Detect a cycle in a directed graph.',
  ],
  'g.topo': [
    'Order a set of dependencies — this page lays itself out that way.',
    'Detect the cycle that makes an order impossible.',
    'Do it once with DFS and once with in-degrees.',
  ],
  'g.dijkstra': [
    'Implement it with a priority queue.',
    'Show what breaks when an edge is negative.',
    'Reconstruct the path, not just its length.',
  ],
  'g.mst': [
    "Implement Kruskal's with union-find.",
    "Implement Prim's and compare when each is better.",
    'Use one on a real distance matrix.',
  ],
  'g.flow': [
    'Implement Edmonds–Karp on a small network.',
    'Find the min cut that matches your max flow.',
    'Model one matching problem as a flow problem.',
  ],

  // ---- Systems ----------------------------------------------------------
  's.memory': [
    'Draw the stack and heap for a small program.',
    'Find what makes one data structure use more memory than another.',
    "Watch a process's memory grow and work out why.",
  ],
  's.pointers': [
    'Pass something by value and by reference and observe the difference.',
    'Draw the arrows for a linked structure on paper.',
    'Cause a null dereference on purpose and read the crash.',
  ],
  's.processes': [
    'List the running processes and find one you started.',
    'Spawn a child process and read its output.',
    'Send a signal to a process and handle it.',
  ],
  's.threads': [
    'Run two threads and prove they interleave.',
    'Share one counter between them and watch it go wrong.',
    'Fix it with a lock, then measure what the lock cost.',
  ],
  's.concurrency': [
    'Reproduce a race condition reliably.',
    'Cause a deadlock, then fix it by ordering the locks.',
    'Replace shared state with a queue and compare.',
  ],
  's.files': [
    'Read and write a file without loading all of it into memory.',
    'Handle the file not existing, and being locked.',
    'Write to a temporary file and rename it into place.',
  ],
  's.net': [
    'Open a socket and speak HTTP by hand.',
    'Watch a real request with a packet inspector.',
    'Explain what DNS did before any of it started.',
  ],
  's.db': [
    'Write the five queries you actually need, then index for them.',
    'Break something with a missing transaction, then fix it.',
    'Explain one query plan out loud.',
  ],

  // ---- Mathematics ------------------------------------------------------
  'm.arith': [
    'Do twenty mental sums a day for a week; time yourself.',
    'Estimate before calculating, every time.',
    'Work one long division out fully on paper.',
  ],
  'm.fractions': [
    'Add, subtract, multiply and divide five fractions without a calculator.',
    'Convert between fractions, decimals and percentages both ways.',
    'Explain to someone why dividing flips the second fraction.',
  ],
  'm.algebra': [
    'Solve ten equations and check every answer by substituting back.',
    'Rearrange one formula for each of its variables.',
    'Turn three word problems into equations before solving any of them.',
  ],
  'm.geometry': [
    'Prove one theorem you have only ever used.',
    'Draw the diagram before writing anything, every time.',
    'Find the area of something irregular by cutting it up.',
  ],
  'm.functions': [
    'Sketch five functions without plotting points.',
    'Compose two functions and find the inverse of one.',
    'Explain domain and range for a function that has limits on both.',
  ],
  'm.trig': [
    'Derive the unit circle rather than memorising it.',
    'Prove one identity from another.',
    'Solve a triangle with the sine and the cosine rule.',
  ],
  'm.stats': [
    'Compute mean, median and spread for a real dataset of your own.',
    'Find a chart that misleads and say exactly how.',
    'Explain what a standard deviation of 3 means here, in words.',
  ],
  'm.prob': [
    'Work out one problem with a tree diagram and again with the formula.',
    'Simulate it a thousand times in code and compare.',
    'Get the Monty Hall problem right, and be able to say why.',
  ],
  'm.precalc': [
    'Graph a rational function including its asymptotes.',
    'Work with logs and exponents until the rules are automatic.',
    'Do one sequence and one series by hand.',
  ],
  'm.linalg': [
    'Multiply matrices by hand until it is boring.',
    'Solve a system three ways: substitution, elimination, matrices.',
    'Say what a determinant of zero means geometrically.',
  ],

  // ---- Calculus ---------------------------------------------------------
  'k.limits': [
    'Evaluate five limits numerically, then algebraically, and compare.',
    'Find one limit that does not exist and say why.',
    'Explain continuity using a function that fails it.',
  ],
  'k.deriv': [
    'Differentiate from first principles three times before using any rule.',
    'Say what the derivative *means* for one real quantity.',
    'Sketch a function and its derivative on the same axes.',
  ],
  'k.rules': [
    'Do twenty derivatives mixing product, quotient and chain.',
    'Find a derivative you got wrong and identify which rule slipped.',
    'Differentiate something implicitly.',
  ],
  'k.optim': [
    'Solve one real maximisation problem end to end, units and all.',
    'Check second derivatives rather than assuming.',
    'Handle a problem where the answer is at an endpoint.',
  ],
  'k.integral': [
    'Compute one area as a Riemann sum before integrating it.',
    'Do ten integrals by substitution.',
    'Integrate by parts twice in one problem.',
  ],
  'k.ftc': [
    'State both parts in your own words, without notation.',
    'Use it to evaluate a definite integral you first did as a sum.',
    'Differentiate an integral with a variable limit.',
  ],
  'k.series': [
    'Test five series for convergence, naming the test each time.',
    'Build a Taylor series for a function you know.',
    'Find where a power series stops working.',
  ],

  // ---- Music ------------------------------------------------------------
  'mu.rhythm': [
    'Play along to a metronome at three tempos, including a slow one.',
    'Clap a rhythm while counting out loud.',
    'Record yourself and find where you rushed.',
  ],
  'mu.notes': [
    'Sight-read something new every day, badly and without stopping.',
    'Name notes on flashcards until you stop counting up from the bottom.',
    'Read one line in a clef you find awkward.',
  ],
  'mu.scales': [
    'Play one scale in every key over a week.',
    'Play it in thirds, and in a broken pattern.',
    'Find the scale a piece you like is built from.',
  ],
  'mu.intervals': [
    'Sing an interval before playing it, then check.',
    'Name intervals on the page at sight, ten a day.',
    'Attach each interval to a song you already know.',
  ],
  'mu.chords': [
    'Build every triad in one key from its scale.',
    'Play the same chord in three inversions.',
    'Work out the chords of a song by ear.',
  ],
  'mu.keys': [
    'Write out the circle of fifths from memory.',
    'Identify the key of five pieces from their signature and last chord.',
    'Transpose eight bars into a new key by hand.',
  ],
  'mu.ear': [
    'Do five minutes of interval recognition daily — daily matters more than long.',
    'Transcribe one bar of a melody a day.',
    'Identify major and minor before anything else.',
  ],
  'mu.progressions': [
    'Play I–V–vi–IV in four keys.',
    'Find that progression in three songs you already own.',
    'Write eight bars using only diatonic chords.',
  ],

  // ---- Science ----------------------------------------------------------
  'sc.method': [
    'Turn one vague question into a testable hypothesis.',
    'Design an experiment and name its control.',
    'Find a study that confused correlation with cause.',
  ],
  'sc.measure': [
    'Measure one thing five times and report the spread, not just the number.',
    'Carry units through a calculation and check they survive.',
    'Convert between three unit systems without a calculator.',
  ],
  'sc.physics': [
    'Draw a free-body diagram for five situations.',
    'Solve one problem with energy and again with forces.',
    'Estimate an answer before solving, and check the order of magnitude.',
  ],
  'sc.chem': [
    'Balance ten equations.',
    'Do one mole calculation end to end.',
    'Predict a reaction, then look up whether you were right.',
  ],
  'sc.bio': [
    'Draw one system from memory and label it.',
    'Follow one molecule through a whole process.',
    'Explain a mechanism to someone without using jargon.',
  ],
  'sc.energy': [
    'Trace energy through three transformations and account for the losses.',
    'Calculate kinetic and potential energy for one real object.',
    'Find where the energy actually goes in something everyday.',
  ],
  'sc.cells': [
    'Label an organelle diagram from memory.',
    'Compare a plant and an animal cell without looking.',
    'Follow one cell through division, stage by stage.',
  ],
  'sc.dna': [
    'Transcribe and translate a short sequence by hand.',
    'Work out what one point mutation changes.',
    'Explain replication as a series of steps, in order.',
  ],
};

/**
 * What to go and do about a node.
 *
 * Falls back to advice assembled from the graph rather than to nothing: the
 * name is always known, and what a node opens is often the best reason to
 * bother with it.
 */
export function improveSteps(node: GraphNode, opens: GraphNode[] = []): string[] {
  const written = IMPROVE[node.id];
  if (written && written.length > 0) return written;

  const steps = [
    `Find three small problems that need ${node.name.toLowerCase()} and solve them.`,
    'Explain it out loud to someone; the gaps show up where you hesitate.',
  ];
  if (opens.length > 0) {
    steps.push(`Start ${opens[0]!.name}, which this one opens — using it is how it sticks.`);
  }
  return steps;
}

/**
 * The one line above the steps, which is about *this* reader rather than about
 * the skill: where they stand on it and what that makes the next move.
 */
export function improveHeadline(node: GraphNode, blockers: GraphNode[]): string {
  if (node.status === 'locked') {
    const names = blockers.map((entry) => entry.name);
    if (names.length === 0) return 'Locked until its prerequisites are done.';
    const list =
      names.length === 1
        ? names[0]!
        : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]!}`;
    return `Finish ${list} first — then this opens.`;
  }
  if (node.status === 'complete') return 'Mastered. Worth keeping sharp:';
  if (node.status === 'progress') {
    return `${Math.round(node.percent)}% of the way. To move it:`;
  }
  return 'Not started. A good first session:';
}
