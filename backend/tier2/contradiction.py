"""Tier 2: Contradiction Detection

Cross-references structured observation data with NLP-extracted clinical signals
to detect logical inconsistencies.
"""
from typing import List, Dict, Optional
from datetime import datetime, timedelta
from sqlalchemy.orm import Session

from database import Patient, Observation, ClinicalNote, Alert
from tier2.nlp_engine import extract_signals
from tier2.keywords import KEYWORD_TAXONOMY


# ────────────────────────────────────────────────────────────
# Contradiction rules: (structured_signal, note_signal) → alert
# ────────────────────────────────────────────────────────────

def run_tier2_validation(patient: Patient, db: Session) -> List[Dict]:
    """
    Run Tier 2 (NLP context matching) on a patient.

    Steps:
    1. Extract signals from all clinical notes
    2. Cross-reference with observation trajectories
    3. Generate contradiction alerts
    """
    all_alerts = []

    # Get observations and notes
    observations = (
        db.query(Observation)
        .filter(Observation.patient_id == patient.id)
        .order_by(Observation.effective_date)
        .all()
    )
    notes = (
        db.query(ClinicalNote)
        .filter(ClinicalNote.patient_id == patient.id)
        .order_by(ClinicalNote.effective_date)
        .all()
    )

    if not observations or not notes:
        return all_alerts

    # Extract signals from each note
    for note in notes:
        signals = extract_signals(note.content)
        note.extracted_signals = signals  # Store for UI display

    db.flush()

    # Aggregate all signals across notes
    all_signals = {}
    for note in notes:
        if note.extracted_signals:
            for cat, keywords in note.extracted_signals.items():
                if cat not in all_signals:
                    all_signals[cat] = {"keywords": set(), "note_dates": []}
                all_signals[cat]["keywords"].update(keywords)
                all_signals[cat]["note_dates"].append(note.effective_date)

    # Get weight trajectory
    weights = [
        (o.id, o.value, o.effective_date)
        for o in observations if o.type == "weight"
    ]
    weights.sort(key=lambda x: x[2])

    # ── Contradiction checks ──

    # Rule 1: Weight↑ + Fluid overload/edema in notes
    if "fluid_overload" in all_signals and len(weights) >= 2:
        for i in range(1, len(weights)):
            prev_w = weights[i - 1][1]
            curr_w = weights[i][1]
            if curr_w > prev_w + 0.2:  # Weight increased
                all_alerts.append({
                    "alert_type": "CONTEXT_FLUID",
                    "severity": "high",
                    "message": (
                        f"Weight increased from {prev_w:.1f} kg to {curr_w:.1f} kg "
                        f"(+{curr_w - prev_w:.2f} kg), but clinical notes mention "
                        f"fluid overload/edema ({', '.join(all_signals['fluid_overload']['keywords'])}). "
                        f"Weight gain may reflect fluid retention, not nutritional improvement."
                    ),
                    "observation_id": weights[i][0],
                })
                break  # One alert per contradiction type

    # Rule 2: Weight stable + prolonged poor intake
    if "poor_intake" in all_signals and len(weights) >= 3:
        # Check if weight is stable over ≥3 measurements
        recent_weights = [w[1] for w in weights[-4:]]
        weight_range = max(recent_weights) - min(recent_weights)
        if weight_range < 0.3:  # Essentially stable
            all_alerts.append({
                "alert_type": "CONTEXT_INTAKE",
                "severity": "warning",
                "message": (
                    f"Weight has been stable ({min(recent_weights):.1f}-{max(recent_weights):.1f} kg) "
                    f"over recent measurements, but clinical notes document poor intake "
                    f"({', '.join(all_signals['poor_intake']['keywords'])}). "
                    f"Verify measurements are current and not carried forward."
                ),
            })

    # Rule 3: Weight↑ + Diuretic therapy
    if "diuretic" in all_signals and len(weights) >= 2:
        last_w = weights[-1][1]
        prev_w = weights[-2][1]
        if last_w > prev_w + 0.2:
            all_alerts.append({
                "alert_type": "CONTEXT_DIURETIC",
                "severity": "high",
                "message": (
                    f"Weight increased from {prev_w:.1f} kg to {last_w:.1f} kg "
                    f"despite active diuretic therapy mentioned in notes "
                    f"({', '.join(all_signals['diuretic']['keywords'])}). "
                    f"This is unexpected – review fluid balance."
                ),
                "observation_id": weights[-1][0],
            })

    # Rule 4: Malnutrition diagnosis but BMI/weight z-score normal
    if "malnutrition" in all_signals:
        last_weight_obs = None
        for o in reversed(observations):
            if o.type == "weight" and o.zscore is not None:
                last_weight_obs = o
                break

        if last_weight_obs and last_weight_obs.zscore > -1.5:
            all_alerts.append({
                "alert_type": "CONTEXT_DX_MISMATCH",
                "severity": "warning",
                "message": (
                    f"Clinical notes mention malnutrition "
                    f"({', '.join(all_signals['malnutrition']['keywords'])}), "
                    f"but latest weight z-score is {last_weight_obs.zscore:+.1f} "
                    f"({last_weight_obs.zscore_interpretation}). "
                    f"Verify diagnosis aligns with anthropometric data."
                ),
                "observation_id": last_weight_obs.id,
            })

    # Rule 5: Weight↓ rapidly + no clinical explanation
    if len(weights) >= 2:
        last_w = weights[-1][1]
        prev_w = weights[-2][1]
        if prev_w - last_w > 0.5:  # Significant loss
            # Check if any explaining signals exist
            explaining_signals = {"dehydration", "diarrhea", "vomiting", "diuretic", "surgery", "poor_intake"}
            has_explanation = any(s in all_signals for s in explaining_signals)

            if not has_explanation:
                all_alerts.append({
                    "alert_type": "CONTEXT_UNEXPLAINED_LOSS",
                    "severity": "high",
                    "message": (
                        f"Weight decreased from {prev_w:.1f} kg to {last_w:.1f} kg "
                        f"(-{prev_w - last_w:.2f} kg) without documented clinical cause "
                        f"in notes. Check for measurement error or undocumented clinical event."
                    ),
                    "observation_id": weights[-1][0],
                })

    # ── Save alerts ──
    for a in all_alerts:
        existing = (
            db.query(Alert)
            .filter(
                Alert.patient_id == patient.id,
                Alert.alert_type == a["alert_type"],
                Alert.resolved == False,
            )
            .first()
        )
        if not existing:
            alert = Alert(
                patient_id=patient.id,
                observation_id=a.get("observation_id"),
                tier="tier2",
                severity=a["severity"],
                alert_type=a["alert_type"],
                message=a["message"],
            )
            db.add(alert)

    db.commit()
    return all_alerts
