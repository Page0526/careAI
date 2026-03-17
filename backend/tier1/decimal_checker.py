"""Tier 1: Decimal Error Checker

Detects when decimal point might be misplaced, e.g.:
- 5.0 kg instead of 50 kg for a 10-year-old
- 150 kg instead of 15.0 kg for a toddler
"""
from typing import List, Dict
from tier1.zscore import get_weight_range, get_median_weight, get_median_height


def check_decimal_error_weight(value_kg: float, age_months: float, gender: str) -> List[Dict]:
    """Check if weight has decimal placement error."""
    alerts = []
    min_w, max_w = get_weight_range(age_months, gender, sd_low=-4, sd_high=4)

    in_range = min_w <= value_kg <= max_w
    if in_range:
        return alerts

    # Check value × 10
    val_x10 = value_kg * 10
    if min_w <= val_x10 <= max_w:
        alerts.append({
            "alert_type": "DECIMAL_ERROR",
            "severity": "critical",
            "message": (
                f"Weight {value_kg} kg is implausibly low for age {age_months:.0f}m. "
                f"Possible decimal error: {value_kg} kg might be {val_x10:.1f} kg."
            ),
            "suggested_value": round(val_x10, 2),
        })

    # Check value ÷ 10
    val_d10 = value_kg / 10
    if min_w <= val_d10 <= max_w:
        alerts.append({
            "alert_type": "DECIMAL_ERROR",
            "severity": "critical",
            "message": (
                f"Weight {value_kg} kg is implausibly high for age {age_months:.0f}m. "
                f"Possible decimal error: {value_kg} kg might be {val_d10:.1f} kg."
            ),
            "suggested_value": round(val_d10, 2),
        })

    return alerts


def check_decimal_error_height(value_cm: float, age_months: float, gender: str) -> List[Dict]:
    """Check if height has decimal placement error."""
    alerts = []
    median_h = get_median_height(age_months, gender)
    min_h = median_h * 0.7
    max_h = median_h * 1.3

    in_range = min_h <= value_cm <= max_h
    if in_range:
        return alerts

    val_x10 = value_cm * 10
    if min_h <= val_x10 <= max_h:
        alerts.append({
            "alert_type": "DECIMAL_ERROR",
            "severity": "critical",
            "message": (
                f"Height {value_cm} cm is implausibly low. "
                f"Possible decimal error: might be {val_x10:.1f} cm."
            ),
            "suggested_value": round(val_x10, 1),
        })

    val_d10 = value_cm / 10
    if min_h <= val_d10 <= max_h:
        alerts.append({
            "alert_type": "DECIMAL_ERROR",
            "severity": "critical",
            "message": (
                f"Height {value_cm} cm is implausibly high. "
                f"Possible decimal error: might be {val_d10:.1f} cm."
            ),
            "suggested_value": round(val_d10, 1),
        })

    return alerts
