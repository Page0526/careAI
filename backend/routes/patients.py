"""Patient routes – CRUD + search."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import Optional
from database import get_db, Patient, Observation, ClinicalNote, Alert

router = APIRouter()


@router.get("/patients")
async def list_patients(
    search: Optional[str] = None,
    ward: Optional[str] = None,
    risk: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """List patients with optional filters."""
    query = db.query(Patient)

    if search:
        query = query.filter(
            or_(
                Patient.name.ilike(f"%{search}%"),
                Patient.medical_record_number.ilike(f"%{search}%"),
            )
        )
    if ward:
        query = query.filter(Patient.ward == ward)
    if risk:
        query = query.filter(Patient.risk_level == risk)

    patients = query.order_by(Patient.data_quality_score.asc()).all()

    result = []
    for p in patients:
        alert_count = db.query(Alert).filter(
            Alert.patient_id == p.id,
            Alert.resolved == False,
        ).count()

        result.append({
            "id": p.id,
            "medical_record_number": p.medical_record_number,
            "name": p.name,
            "date_of_birth": p.date_of_birth.isoformat(),
            "gender": p.gender,
            "age_months": round(p.age_months, 1),
            "ward": p.ward,
            "room": p.room,
            "diagnosis": p.diagnosis,
            "admission_date": p.admission_date.isoformat(),
            "risk_level": p.risk_level,
            "data_quality_score": p.data_quality_score,
            "alert_count": alert_count,
        })

    return {"patients": result, "total": len(result)}


@router.get("/patients/{patient_id}")
async def get_patient(patient_id: int, db: Session = Depends(get_db)):
    """Get patient detail with observations, notes, alerts."""
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    observations = (
        db.query(Observation)
        .filter(Observation.patient_id == patient_id)
        .order_by(Observation.effective_date)
        .all()
    )

    notes = (
        db.query(ClinicalNote)
        .filter(ClinicalNote.patient_id == patient_id)
        .order_by(ClinicalNote.effective_date)
        .all()
    )

    alerts = (
        db.query(Alert)
        .filter(Alert.patient_id == patient_id)
        .order_by(Alert.created_at.desc())
        .all()
    )

    return {
        "patient": {
            "id": patient.id,
            "medical_record_number": patient.medical_record_number,
            "name": patient.name,
            "date_of_birth": patient.date_of_birth.isoformat(),
            "gender": patient.gender,
            "age_months": round(patient.age_months, 1),
            "age_years": round(patient.age_years, 1),
            "ward": patient.ward,
            "room": patient.room,
            "diagnosis": patient.diagnosis,
            "admission_date": patient.admission_date.isoformat(),
            "discharge_date": patient.discharge_date.isoformat() if patient.discharge_date else None,
            "admission_weight_kg": patient.admission_weight_kg,
            "admission_height_cm": patient.admission_height_cm,
            "risk_level": patient.risk_level,
            "data_quality_score": patient.data_quality_score,
        },
        "observations": [
            {
                "id": o.id,
                "type": o.type,
                "value": o.value,
                "unit": o.unit,
                "effective_date": o.effective_date.isoformat(),
                "zscore": o.zscore,
                "zscore_interpretation": o.zscore_interpretation,
                "data_quality_score": o.data_quality_score,
            }
            for o in observations
        ],
        "notes": [
            {
                "id": n.id,
                "content": n.content,
                "note_type": n.note_type,
                "author": n.author,
                "effective_date": n.effective_date.isoformat(),
                "extracted_signals": n.extracted_signals,
            }
            for n in notes
        ],
        "alerts": [
            {
                "id": a.id,
                "tier": a.tier,
                "severity": a.severity,
                "alert_type": a.alert_type,
                "message": a.message,
                "explanation": a.explanation,
                "resolved": a.resolved,
                "resolved_by": a.resolved_by,
                "created_at": a.created_at.isoformat() if a.created_at else None,
            }
            for a in alerts
        ],
    }
