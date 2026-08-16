"""The growth tree — the branching skill/progress tree.

**Built, and it needs nothing from here.** The page is
frontend/src/pages/SkillTrees.tsx, served at /skill-trees (the old
/growth-tree redirects to it), and every number on it is derived in the browser
from two calls that already exist: /api/get_user_data for the finished tasks
and /api/subjects for the catalogue to group them by. A node opens when a
threshold on XP, finished tasks or distinct days is crossed, and all three are
already on the task rows those calls return.

This file stays empty on purpose rather than being deleted. The moment a node
becomes something the *server* decides — anything the client cannot recompute
from the task list, such as a node awarded once and kept — it needs a row of
its own and this is where its endpoints go. Nothing on the page today is that.
The rules would belong in backend/tracking/tree.py.
"""
