"""Growth tree: the branching skill/progress tree.

The tree is built and none of its arithmetic is here. It lives in
frontend/src/utils/skillTree.ts, because every quantity it reads — XP filed
under a subject, tasks finished in it, distinct days it was worked — is already
on the task rows /api/get_user_data returns, and a second implementation of the
same three sums on this side would be one more place for them to disagree.

What would bring the rules back here: a node that cannot be recomputed from the
task list. An unlock the account keeps after the work behind it is deleted, a
node with a prerequisite in another subject, anything awarded once and stored.
None of those exist, and inventing one to justify the module would be the
fiction the page was careful not to be — see the note at the top of
utils/skillTree.ts. Until then, backend/api/growthtree.py has the other half of
this note.
"""
