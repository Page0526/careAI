"""Tier 1: Duplicate and Carried-Forward Checker

Detects:
- Exact duplicate values on consecutive days
- Carried-forward values (same value repeated ≥3 times without re-measurement)
"""
from typing import List, Dict, Tuple
from datetime import datetime, timedelta
from config import CARRIED_FORWARD_DAYS


def check_duplicates_and_carried_forward(
    observations: List[Tuple[int, float, str, datetime]]
) -> List[Dict]:
    """
    Check for duplicates and carried-forward values in a sequence of observations.

    Args:
        observations: List of (obs_id, value, unit, effective_date) sorted by date

    Returns:
        List of alert dicts
    """
    alerts = []

    if len(observations) < 2:
        return alerts

    # Sort by date
    sorted_obs = sorted(observations, key=lambda x: x[3])

    # Track consecutive identical values
    streak_start = 0
    for i in range(1, len(sorted_obs)):
        prev_id, prev_val, prev_unit, prev_date = sorted_obs[i - 1]
        curr_id, curr_val, curr_unit, curr_date = sorted_obs[i]

        if abs(curr_val - prev_val) < 0.001 and curr_unit == prev_unit:
            # Same value continues
            pass
        else:
            # Streak broken – check if previous streak was long enough
            streak_len = i - streak_start
            if streak_len >= 2:
                _check_streak(sorted_obs, streak_start, i, alerts)
            streak_start = i

    # Check final streak
    streak_len = len(sorted_obs) - streak_start
    if streak_len >= 2:
        _check_streak(sorted_obs, streak_start, len(sorted_obs), alerts)

    return alerts


def _check_streak(
    observations: List[Tuple[int, float, str, datetime]],
    start: int,
    end: int,
    alerts: List[Dict],
):
    """Evaluate a streak of identical values."""
    streak_len = end - start
    first = observations[start]
    last = observations[end - 1]
    value = first[1]
    days_span = (last[3] - first[3]).days

    if streak_len == 2 and days_span <= 1:
        # Two identical values on same/next day = potential duplicate entry
        alerts.append({
            "alert_type": "DUPLICATE_ENTRY",
            "severity": "warning",
            "message": (
                f"Value {value} {first[2]} appears twice within {days_span} day(s). "
                f"Possible duplicate entry."
            ),
            "observation_ids": [observations[i][0] for i in range(start, end)],
            "dates": [observations[i][3].isoformat() for i in range(start, end)],
        })

    if streak_len >= CARRIED_FORWARD_DAYS:
        # Same value repeated ≥3 times = carried forward
        alerts.append({
            "alert_type": "CARRIED_FORWARD",
            "severity": "warning",
            "message": (
                f"Value {value} {first[2]} is identical across {streak_len} "
                f"consecutive entries over {days_span} day(s). "
                f"This may be a carried-forward value without re-measurement."
            ),
            "observation_ids": [observations[i][0] for i in range(start, end)],
            "dates": [observations[i][3].isoformat() for i in range(start, end)],
        })
