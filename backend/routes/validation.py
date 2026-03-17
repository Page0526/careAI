"""Validation routes – trigger Tier 1 + Tier 2 validation."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from database import get_db, Patient, Alert
from tier1.validator import run_tier1_validation
from tier2.contradiction import run_tier2_validation

router = APIRouter()


@router.post("/validate/{patient_id}")
async def validate_patient(patient_id: int, db: Session = Depends(get_db)):
    """Run full validation pipeline (Tier 1 + Tier 2) on a patient."""
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    # Clear existing unresolved alerts
    db.query(Alert).filter(
        Alert.patient_id == patient_id,
        Alert.resolved == False,
    ).delete()
    db.commit()

    # Run Tier 1
    tier1_alerts = run_tier1_validation(patient, db)

    # Run Tier 2
    tier2_alerts = run_tier2_validation(patient, db)

    all_alerts = tier1_alerts + tier2_alerts

    return {
        "patient_id": patient_id,
        "patient_name": patient.name,
        "data_quality_score": patient.data_quality_score,
        "risk_level": patient.risk_level,
        "tier1_alerts": len(tier1_alerts),
        "tier2_alerts": len(tier2_alerts),
        "total_alerts": len(all_alerts),
        "alerts": all_alerts,
    }


@router.post("/validate/batch")
async def validate_batch(ward: str = Query(default=None), db: Session = Depends(get_db)):
    """Validate all patients (optionally filtered by ward)."""
    query = db.query(Patient)
    if ward:
        query = query.filter(Patient.ward == ward)
    patients = query.all()

    results = []
    for patient in patients:
        # Clear existing
        db.query(Alert).filter(
            Alert.patient_id == patient.id,
            Alert.resolved == False,
        ).delete()
        db.commit()

        t1 = run_tier1_validation(patient, db)
        t2 = run_tier2_validation(patient, db)

        results.append({
            "patient_id": patient.id,
            "name": patient.name,
            "data_quality_score": patient.data_quality_score,
            "risk_level": patient.risk_level,
            "alert_count": len(t1) + len(t2),
        })

    results.sort(key=lambda x: x["data_quality_score"])

    return {
        "validated": len(results),
        "patients": results,
    }


@router.get("/alerts")
async def list_alerts(
    severity: str = None,
    resolved: bool = False,
    patient_id: int = None,
    db: Session = Depends(get_db),
):
    """List alerts with optional filters."""
    query = db.query(Alert).filter(Alert.resolved == resolved)
    if severity:
        query = query.filter(Alert.severity == severity)
    if patient_id:
        query = query.filter(Alert.patient_id == patient_id)

    alerts = query.order_by(Alert.created_at.desc()).all()

    return {
        "alerts": [
            {
                "id": a.id,
                "patient_id": a.patient_id,
                "tier": a.tier,
                "severity": a.severity,
                "alert_type": a.alert_type,
                "message": a.message,
                "resolved": a.resolved,
                "created_at": a.created_at.isoformat() if a.created_at else None,
            }
            for a in alerts
        ]
    }


@router.patch("/alerts/{alert_id}/resolve")
async def resolve_alert(alert_id: int, resolved_by: str = "user", db: Session = Depends(get_db)):
    """Resolve an alert."""
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    from datetime import datetime
    alert.resolved = True
    alert.resolved_by = resolved_by
    alert.resolved_at = datetime.utcnow()
    db.commit()

    return {"status": "resolved", "alert_id": alert_id}
