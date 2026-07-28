"""The growth page — the chart and the report card.

Both endpoints are thin: the shapes they return are built in
backend/tracking/growth.py, which is where the grading rules live.
"""
from flask import Blueprint, jsonify, render_template, request

from backend.tracking import analytics as analytics_tracking
from backend.tracking import growth as growth_tracking
from backend.tracking import xp as xp_tracking

bp = Blueprint('growth', __name__)


@bp.route('/growth')
def page():
    return render_template('growth.html')


@bp.route('/api/get_growth_data', methods=['GET'])
def get_growth_data():
    """Day-by-day XP, tasks and focus since the account was created."""
    username = request.args.get('username')
    if not username:
        return jsonify({"success": False, "message": "Username required"})

    data = growth_tracking.series(username)
    if data is None:
        return jsonify({"success": False, "message": "User not found"})
    return jsonify({"success": True, **data})


@bp.route('/api/get_growth_ratings', methods=['GET'])
def get_growth_ratings():
    """The five-metric graded report card.

    Computed in tracking/analytics.py, which also files the result away in
    analytics.sql so the grades build up a history.
    """
    username = request.args.get('username')
    if not username:
        return jsonify({"success": False, "message": "Username required"})

    ratings = analytics_tracking.ratings(username)
    if ratings is None:
        return jsonify({"success": False, "message": "User not found"})
    return jsonify({"success": True, **ratings})


@bp.route('/api/get_xp_data', methods=['GET'])
def get_xp_data():
    """The XP ledger rolled up: level, lifetime totals and a per-day series."""
    username = request.args.get('username')
    if not username:
        return jsonify({"success": False, "message": "Username required"})
    return jsonify(xp_tracking.snapshot(username))
