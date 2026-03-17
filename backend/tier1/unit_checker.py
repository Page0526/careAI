"""Tier 1: Unit Confusion Checker

Detects when values appear to be entered in wrong units:
- Weight: kg entered as lb (or vice versa)
- Height: cm entered as m (or vice versa)
"""
from typing import List, Dict
from tier1.zscore import get_weight_range, get_median_weight, get_median_height

# Conversion factors
KG_TO_LB = 2.20462
LB_TO_KG = 0.453592
CM_TO_M = 0.01
M_TO_CM = 100


def check_unit_confusion_weight(value_kg: float, age_months: float, gender: str) -> List[Dict]:
    """
    Check if a weight value might be in wrong units.
    Returns list of alerts if issues found.
    """
    alerts = []
    min_w, max_w = get_weight_range(age_months, gender, sd_low=-4, sd_high=4)

    # Check: value seems reasonable as-is?
    in_range = min_w <= value_kg <= max_w

    if not in_range:
        # Check if value makes sense as pounds converted to kg
        as_kg_from_lb = value_kg * LB_TO_KG
        in_range_as_lb = min_w <= as_kg_from_lb <= max_w

        if in_range_as_lb and value_kg > max_w * 0.8:
            alerts.append({
                "alert_type": "UNIT_CONFUSION",
                "severity": "critical",
                "message": (
                    f"Weight {value_kg} kg is implausible for age {age_months:.0f}m. "
                    f"If interpreted as {value_kg} lb → {as_kg_from_lb:.1f} kg, "
                    f"it falls within normal range. Possible lb→kg confusion."
                ),
                "suggested_value": round(as_kg_from_lb, 2),
                "suggested_unit": "kg (converted from lb)",
            })

        # Check if value is implausibly small (kg entered as half?)
        as_kg_doubled = value_kg * KG_TO_LB
        in_range_doubled = min_w <= as_kg_doubled <= max_w

        if in_range_doubled and value_kg < min_w * 1.2:
            alerts.append({
                "alert_type": "UNIT_CONFUSION",
                "severity": "critical",
                "message": (
                    f"Weight {value_kg} kg is unusually low for age {age_months:.0f}m. "
                    f"If interpreted as kg→lb conversion error, actual weight might be "
                    f"~{as_kg_doubled:.1f} kg. Please verify."
                ),
                "suggested_value": round(as_kg_doubled, 2),
                "suggested_unit": "kg (possible reverse conversion)",
            })

    return alerts


def check_unit_confusion_height(value_cm: float, age_months: float, gender: str) -> List[Dict]:
    """
    Check if a height value might be in wrong units.
    Returns list of alerts if issues found.
    """
    alerts = []
    median_h = get_median_height(age_months, gender)
    min_h = median_h * 0.7
    max_h = median_h * 1.3

    in_range = min_h <= value_cm <= max_h

    if not in_range:
        # Check if value is in meters instead of cm
        if value_cm < 3.0:
            as_cm = value_cm * M_TO_CM
            if min_h <= as_cm <= max_h:
                alerts.append({
                    "alert_type": "UNIT_CONFUSION",
                    "severity": "critical",
                    "message": (
                        f"Height {value_cm} cm is implausibly low. "
                        f"If interpreted as {value_cm} m → {as_cm:.1f} cm, "
                        f"it falls within normal range. Possible m entered as cm."
                    ),
                    "suggested_value": round(as_cm, 1),
                    "suggested_unit": "cm (converted from m)",
                })

        # Check if cm entered as mm or vice versa
        if value_cm > max_h:
            as_cm_from_mm = value_cm / 10.0
            if min_h <= as_cm_from_mm <= max_h:
                alerts.append({
                    "alert_type": "UNIT_CONFUSION",
                    "severity": "high",
                    "message": (
                        f"Height {value_cm} cm is unusually tall. "
                        f"If interpreted as mm → {as_cm_from_mm:.1f} cm, "
                        f"it falls within normal range. Possible mm→cm error."
                    ),
                    "suggested_value": round(as_cm_from_mm, 1),
                    "suggested_unit": "cm (converted from mm)",
                })

    return alerts
