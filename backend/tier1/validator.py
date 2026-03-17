"""Tier 1: Validation Orchestrator

Runs all Tier 1 checks on a patient's observations and returns aggregated alerts.
"""
from typing import List, Dict
from datetime import datetime, date
from sqlalchemy.orm import Session

from database import Patient, Observation, Alert
from tier1.unit_checker import check_unit_confusion_weight, check_unit_confusion_height
from tier1.decimal_checker import check_decimal_error_weight, check_decimal_error_height
from tier1.duplicate_checker import check_duplicates_and_carried_forward
from tier1.trajectory_checker import (
    check_physiological_bounds,
    check_weight_trajectory,
    check_height_decrease,
)
from tier1.zscore import calculate_zscore, interpret_zscore


def run_tier1_validation(patient: Patient, db: Session) -> List[Dict]:
    """
    Run all Tier 1 (rule-based) validation checks on a patient.

    Returns list of alert dictionaries.
    """
    all_alerts = []

    observations = (
        db.query(Observation)
        .filter(Observation.patient_id == patient.id)
        .order_by(Observation.effective_date)
        .all()
    )

    if not observations:
        return all_alerts

    age_months = patient.age_months

    # ── Per-observation checks ──
    for obs in observations:
        obs_age = _obs_age_months(patient, obs)

        # 1. Physiological bounds
        alerts = check_physiological_bounds(obs.value, obs.type, obs_age, patient.gender)
        for a in alerts:
            a["observation_id"] = obs.id
            all_alerts.append(a)

        # 2. Unit confusion
        if obs.type == "weight":
            alerts = check_unit_confusion_weight(obs.value, obs_age, patient.gender)
        elif obs.type == "height":
            alerts = check_unit_confusion_height(obs.value, obs_age, patient.gender)
        else:
            alerts = []

        for a in alerts:
            a["observation_id"] = obs.id
            all_alerts.append(a)

        # 3. Decimal errors
        if obs.type == "weight":
            alerts = check_decimal_error_weight(obs.value, obs_age, patient.gender)
        elif obs.type == "height":
            alerts = check_decimal_error_height(obs.value, obs_age, patient.gender)
        else:
            alerts = []

        for a in alerts:
            a["observation_id"] = obs.id
            all_alerts.append(a)

        # 4. Calculate and store z-score
        if obs.type in ("weight", "height"):
            z = calculate_zscore(obs.value, obs_age, patient.gender, obs.type)
            obs.zscore = z
            obs.zscore_interpretation = interpret_zscore(z)

    # ── Sequence checks (need multiple observations) ──

    # 5. Duplicates & carried-forward (by type)
    for obs_type in ("weight", "height"):
        typed_obs = [
            (o.id, o.value, o.unit, o.effective_date)
            for o in observations if o.type == obs_type
        ]
        alerts = check_duplicates_and_carried_forward(typed_obs)
        for a in alerts:
            all_alerts.append(a)

    # 6. Weight trajectory
    weight_obs = [
        (o.id, o.value, o.effective_date)
        for o in observations if o.type == "weight"
    ]
    alerts = check_weight_trajectory(weight_obs, age_months, patient.gender)
    for a in alerts:
        all_alerts.append(a)

    # 7. Height decrease
    height_obs = [
        (o.id, o.value, o.effective_date)
        for o in observations if o.type == "height"
    ]
    alerts = check_height_decrease(height_obs)
    for a in alerts:
        all_alerts.append(a)

    # ── Save alerts to database ──
    saved_alerts = _save_alerts(patient.id, all_alerts, "tier1", db)

    # ── Update patient data quality score ──
    _update_patient_dq(patient, all_alerts, db)

    db.commit()

    return all_alerts


def _obs_age_months(patient: Patient, obs: Observation) -> float:
    """Calculate patient age in months at time of observation."""
    obs_date = obs.effective_date
    if isinstance(obs_date, datetime):
        obs_date = obs_date.date()
    dob = patient.date_of_birth
    if isinstance(dob, datetime):
        dob = dob.date()
    days = (obs_date - dob).days
    return max(0, days / 30.4375)


def _save_alerts(patient_id: int, alerts: List[Dict], tier: str, db: Session) -> List[Alert]:
    """Save alerts to database, avoiding duplicates."""
    saved = []
    for a in alerts:
        existing = (
            db.query(Alert)
            .filter(
                Alert.patient_id == patient_id,
                Alert.alert_type == a["alert_type"],
                Alert.message == a["message"],
                Alert.resolved == False,
            )
            .first()
        )
        if existing:
            continue

        alert = Alert(
            patient_id=patient_id,
            observation_id=a.get("observation_id"),
            tier=tier,
            severity=a["severity"],
            alert_type=a["alert_type"],
            message=a["message"],
            explanation=a.get("explanation", ""),
        )
        db.add(alert)
        saved.append(alert)

    return saved


def _update_patient_dq(patient: Patient, alerts: List[Dict], db: Session):
    """Update patient data quality score based on alerts.

    Uses diminishing-returns formula so a single critical alert doesn't
    immediately drop the score to zero. Only truly problematic patients
    (many distinct error types) get very low scores.
    """
    severity_weights = {
        "critical": 18,
        "high": 10,
        "warning": 4,
        "info": 1,
    }

    # Group by alert_type to apply diminishing returns
    type_counts: dict[str, list[str]] = {}
    for a in alerts:
        t = a["alert_type"]
        if t not in type_counts:
            type_counts[t] = []
        type_counts[t].append(a["severity"])

    penalty = 0.0
    for alert_type, severities in type_counts.items():
        # First alert of a type: full weight. Extra alerts: 30% weight each.
        for i, sev in enumerate(severities):
            w = severity_weights.get(sev, 0)
            if i == 0:
                penalty += w
            else:
                penalty += w * 0.3

    # Cap at 100, floor at 0
    score = max(0.0, min(100.0, 100.0 - penalty))
    patient.data_quality_score = round(score, 1)

    # Update risk level
    if score >= 80:
        patient.risk_level = "low"
    elif score >= 60:
        patient.risk_level = "moderate"
    elif score >= 40:
        patient.risk_level = "high"
    else:
        patient.risk_level = "critical"
