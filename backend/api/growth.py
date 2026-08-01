"""The growth page — the chart and the report card.

All three endpoints are thin: the shapes they return are built in
backend/tracking/growth.py and backend/tracking/analytics.py, which is where
the grading rules live.
"""
from fastapi import APIRouter

from backend.api.reply import fail, ok
from backend.tracking import analytics as analytics_tracking
from backend.tracking import growth as growth_tracking
from backend.tracking import xp as xp_tracking

router = APIRouter(tags=['growth'])


@router.get('/api/get_growth_data')
def get_growth_data(username: str = ''):
    """Day-by-day XP, tasks and focus since the account was created."""
    if not username:
        return fail('Username required')

    data = growth_tracking.series(username)
    if data is None:
        return fail('User not found')
    return ok(**data)


@router.get('/api/get_growth_ratings')
def get_growth_ratings(username: str = ''):
    """The five-metric graded report card.

    Computed in tracking/analytics.py, which also files the result into
    metric_snapshots so the grades build up a history.
    """
    if not username:
        return fail('Username required')

    ratings = analytics_tracking.ratings(username)
    if ratings is None:
        return fail('User not found')
    return ok(**ratings)


@router.get('/api/get_xp_data')
def get_xp_data(username: str = ''):
    """The XP ledger rolled up: level, lifetime totals and a per-day series.

    `snapshot` builds its own success flag — it is the one tracker that reports
    a missing account itself — so it is returned as it comes.
    """
    if not username:
        return fail('Username required')
    return xp_tracking.snapshot(username)
