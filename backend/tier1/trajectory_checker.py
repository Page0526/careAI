"""Tier 1: Trajectory Checker

Detects:
- Implausible weight change velocity (too much gain/loss per day)
- Height decrease (height should never decrease)
- Physiological bounds violation
"""
from typing import List, Dict, Tuple
from datetime import datetime
from config import (
    WEIGHT_MIN_KG, WEIGHT_MAX_KG, HEIGHT_MIN_CM, HEIGHT_MAX_CM,
    ZSCORE_EXTREME
)
from tier1.zscore import calculate_zscore, get_median_weight


def check_physiological_bounds(
    value: float, obs_type: str, age_months: float, gender: str
) -> List[Dict]:
    """Check if value is within physiological possibility."""
    alerts = []

    if obs_type == "weight":
        if value < WEIGHT_MIN_KG:
            alerts.append({
                "alert_type": "PHYSIO_BOUNDS",
                "severity": "critical",
                "message": f"Weight {value} kg is below minimum physiological threshold ({WEIGHT_MIN_KG} kg).",
            })
        elif value > WEIGHT_MAX_KG:
            alerts.append({
                "alert_type": "PHYSIO_BOUNDS",
                "severity": "critical",
                "message": f"Weight {value} kg exceeds maximum pediatric threshold ({WEIGHT_MAX_KG} kg).",
            })

        # Check extreme z-score
        z = calculate_zscore(value, age_months, gender, "weight")
        if z is not None and abs(z) > ZSCORE_EXTREME:
            alerts.append({
                "alert_type": "AGE_WEIGHT_MISMATCH",
                "severity": "high",
                "message": (
                    f"Weight {value} kg has z-score {z:+.1f} for age {age_months:.0f}m ({gender}). "
                    f"This is beyond ±{ZSCORE_EXTREME} SD, which is extremely unusual."
                ),
            })

    elif obs_type == "height":
        if value < HEIGHT_MIN_CM:
            alerts.append({
                "alert_type": "PHYSIO_BOUNDS",
                "severity": "critical",
                "message": f"Height {value} cm is below minimum threshold ({HEIGHT_MIN_CM} cm).",
            })
        elif value > HEIGHT_MAX_CM:
            alerts.append({
                "alert_type": "PHYSIO_BOUNDS",
                "severity": "critical",
                "message": f"Height {value} cm exceeds maximum pediatric threshold ({HEIGHT_MAX_CM} cm).",
            })

        z = calculate_zscore(value, age_months, gender, "height")
        if z is not None and abs(z) > ZSCORE_EXTREME:
            alerts.append({
                "alert_type": "AGE_HEIGHT_MISMATCH",
                "severity": "high",
                "message": (
                    f"Height {value} cm has z-score {z:+.1f} for age {age_months:.0f}m ({gender}). "
                    f"This is beyond ±{ZSCORE_EXTREME} SD."
                ),
            })

    return alerts


def check_weight_trajectory(
    observations: List[Tuple[int, float, datetime]],
    age_months: float,
    gender: str,
) -> List[Dict]:
    """
    Check weight change velocity between consecutive measurements.

    Args:
        observations: List of (obs_id, weight_kg, effective_date) sorted by date
        age_months: Current age in months
        gender: 'male' or 'female'
    """
    alerts = []
    if len(observations) < 2:
        return alerts

    sorted_obs = sorted(observations, key=lambda x: x[2])

    # Age-adjusted max daily weight change (simplified)
    # Neonates can gain ~30g/day, older children ~10-20g/day
    median_w = get_median_weight(age_months, gender)
    # Max ~3% of body weight per day as extreme threshold
    max_daily_change = max(0.15, median_w * 0.03)

    for i in range(1, len(sorted_obs)):
        prev_id, prev_w, prev_date = sorted_obs[i - 1]
        curr_id, curr_w, curr_date = sorted_obs[i]

        days = max((curr_date - prev_date).total_seconds() / 86400, 0.01)
        change = curr_w - prev_w
        daily_change = abs(change) / days

        if daily_change > max_daily_change and days >= 0.5:
            direction = "gained" if change > 0 else "lost"
            alerts.append({
                "alert_type": "IMPLAUSIBLE_VEL",
                "severity": "high",
                "message": (
                    f"Patient {direction} {abs(change):.2f} kg over {days:.1f} days "
                    f"({daily_change:.2f} kg/day). Maximum expected: {max_daily_change:.2f} kg/day. "
                    f"Verify measurement accuracy or check for fluid changes."
                ),
                "observation_ids": [prev_id, curr_id],
                "change_kg": round(change, 3),
                "days": round(days, 1),
            })

    return alerts


def check_height_decrease(
    observations: List[Tuple[int, float, datetime]]
) -> List[Dict]:
    """Check if height decreases between consecutive measurements (should never happen)."""
    alerts = []
    if len(observations) < 2:
        return alerts

    sorted_obs = sorted(observations, key=lambda x: x[2])

    for i in range(1, len(sorted_obs)):
        prev_id, prev_h, prev_date = sorted_obs[i - 1]
        curr_id, curr_h, curr_date = sorted_obs[i]

        if curr_h < prev_h - 0.5:  # Allow 0.5cm measurement tolerance
            alerts.append({
                "alert_type": "HEIGHT_DECREASE",
                "severity": "warning",
                "message": (
                    f"Height decreased from {prev_h} cm to {curr_h} cm "
                    f"({prev_h - curr_h:.1f} cm loss). Height should not decrease in children. "
                    f"Check for measurement error or different measurement position."
                ),
                "observation_ids": [prev_id, curr_id],
            })

    return alerts
