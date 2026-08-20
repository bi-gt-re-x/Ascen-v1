/**
 * One prerequisite, as a line.
 *
 * A path and a class, and the class is the whole component — the `d` was worked
 * out by `layoutGraph` in the same coordinate space the nodes are placed in, so
 * there is nothing to measure and nothing to keep in sync while the canvas is
 * panned or zoomed.
 *
 * The four states differ in weight and dash as well as colour: a locked path is
 * a thin dashed hairline, an available one solid and quiet, an in-progress one
 * solid and carrying the accent, a completed one the heaviest of the four. A
 * reader tracing back from a node they want should be able to see where the
 * route they have already taken stops, and that has to survive being looked at
 * from a long way out.
 *
 * `is-lit` is the selection: every path touching the chosen node comes forward
 * so its prerequisites and what it opens read as one run rather than as two
 * lines that happen to meet it.
 */
import type { PlacedEdge } from '@/utils/skillGraph';

export interface SkillConnectionProps {
  edge: PlacedEdge;
  /** Touching the selected node — drawn forward. */
  lit?: boolean;
}

export function SkillConnection({ edge, lit = false }: SkillConnectionProps) {
  return (
    <path
      className={`stx-wire is-${edge.state}${lit ? ' is-lit' : ''}`}
      d={edge.d}
      fill="none"
    />
  );
}
