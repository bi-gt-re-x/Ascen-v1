/**
 * Growth Tree — not built yet.
 *
 * A branching skill tree: which nodes are unlocked, and what unlocks the next one.
 */
import { NotBuilt } from '@/components';
import { useDocumentTitle } from '@/hooks';
import '@/styles/growth-tree.css';

export default function GrowthTree() {
  useDocumentTitle('Growth Tree');

  return (
    <NotBuilt
      name="Growth Tree"
      description="A branching skill tree: which nodes are unlocked, and what unlocks the next one."
      files={[
        'backend/api/growthtree.py — a stub',
        'backend/tracking/tree.py — a stub',
      ]}
    />
  );
}
