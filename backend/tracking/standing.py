"""Where one account stands against the others.

This is the aggregation the "Where You Stand" panel spent its life without.
Every other figure on the analytics page is computed from one account's own
record; these five are the only ones that need every account's, which is why
they were placeholders behind a Sample chip until now.

## What a percentile here means

The panel prints "Top N%", so a *low* number is a good one, and N is the share
of the cohort at or above the reader. It is a plain rank with no distribution
fitted to it and nothing modelled: count how many other accounts this one beats
on a measure, and turn that into a share. Ties split the difference — two
accounts on identical XP place identically rather than one of them arbitrarily
winning on row order.

## Who is in the cohort

Not every row in `users`. An account that signed up and never came back has no
measurable habit, and a cohort mostly made of those places every real account in
the top 1% of nothing. `MIN_ACTIVE_DAYS` is the bar: enough days with work on
them that there is something to compare. The reader is always placed even if
their own record is thinner than that — they are asking where they stand, and
the answer is not "you are not in the cohort" — but they are never counted as
one of the others.

Below `COHORT_FLOOR` others the endpoint reports `enough: False` and no
percentiles at all. A rank out of two accounts is arithmetically fine and
editorially worthless, and the panel would rather say the comparison does not
exist yet than print "Top 50%" and let it be read as a measurement.
"""
from datetime import date

from backend.database import connection as db
from backend.tracking import analytics as analytics_tracking
from backend.tracking import focus as focus_tracking
from backend.tracking import xp as xp_tracking
from backend.tracking.auth import created_date_for, find_user

# Days with work on them before an account counts as somebody to be compared to.
MIN_ACTIVE_DAYS = 3

# Other qualifying accounts needed before a placement is worth printing.
#
# Three is the point where a rank says more than "ahead of somebody": against
# one other account every measure is a coin toss, against two it is a podium.
# It is deliberately low because the panel prints the cohort size next to the
# figures — a reader told they are top 25% of four accounts has been given the
# number *and* what it is worth, which is the honest version of a small sample
# rather than a hidden one.
COHORT_FLOOR = 3

# The measures, in the order the panel lists them. The labels and colours are
# the frontend's business; these keys are the contract between the two.
MEASURES = ('xp', 'focus', 'consistency', 'tasks', 'score')


def _profile(username, user):
    """One account's five measures, over the whole of its history."""
    created = created_date_for(user)
    today = date.today()
    total_days = max((today - created).days + 1, 1)

    totals = xp_tracking.daily_totals(username)
    active_days = sum(1 for bucket in totals.values() if (bucket.get('xp') or 0) > 0)

    focus_minutes = 0.0
    for record in focus_tracking.history_for(username).values():
        try:
            focus_minutes += float(record.get('seconds', 0) or 0) / 60.0
        except (TypeError, ValueError, AttributeError):
            continue

    # `record=False`: this reads every account on the instance, and the default
    # would file a dated snapshot against each of them every time somebody
    # opened their own analytics page.
    card = analytics_tracking.ratings(username, record=False)

    return {
        'active_days': active_days,
        'xp': sum(bucket.get('xp') or 0 for bucket in totals.values()),
        'tasks': sum(bucket.get('tasks') or 0 for bucket in totals.values()),
        'focus': focus_minutes,
        # Capped at 100: an account created today with work on it would
        # otherwise read as more than every day it has existed for.
        'consistency': (min(active_days, total_days) / total_days) * 100.0,
        'score': (card or {}).get('overall', {}).get('score', 0),
    }


def _top_percent(mine, others):
    """`mine` placed among `others`, as the "top N%" the panel prints.

    Ties count as half a win each — the standard midrank — so that a run of
    accounts on the same figure all place together instead of the comparison
    turning on the order they came out of the table.
    """
    if not others:
        return None
    beaten = sum(1 for value in others if value < mine)
    tied = sum(1 for value in others if value == mine)
    share = (beaten + tied * 0.5) / len(others)
    # Bounded away from both ends: "top 0%" claims the reader is beyond every
    # account that could exist, and "top 100%" is not a thing anyone wants read
    # about them.
    return max(1.0, min(99.0, round((1.0 - share) * 100.0, 1)))


def standing(username):
    """The five placements, the cohort behind them, or None with no account."""
    users = db.users()
    me = find_user(users, username=username)
    if not me:
        return None

    mine = _profile(username, me)

    others = []
    for user in users:
        name = user.get('username')
        if not name or name == username:
            continue
        profile = _profile(name, user)
        if profile['active_days'] < MIN_ACTIVE_DAYS:
            continue
        others.append(profile)

    enough = len(others) >= COHORT_FLOOR
    rows = [{
        'key': key,
        'value': round(mine[key], 1),
        'percentile': _top_percent(mine[key], [other[key] for other in others]) if enough else None,
    } for key in MEASURES]

    return {
        # The reader plus everyone they were measured against, which is what
        # "compared to N Ascen users" means on the panel.
        'cohort': len(others) + 1,
        'enough': enough,
        'floor': COHORT_FLOOR,
        'rows': rows,
    }
