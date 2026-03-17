"""Dashboard route – summary stats and overview."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from database import get_db, Patient, Alert, Observation

router = APIRouter()


@router.get("/dashboard/stats")
async def get_dashboard_stats(db: Session = Depends(get_db)):
    """Get dashboard summary statistics."""
    total_patients = db.query(Patient).count()
    total_alerts = db.query(Alert).filter(Alert.resolved == False).count()

    # Average data quality score
    avg_dq = db.query(func.avg(Patient.data_quality_score)).scalar() or 100.0

    # Alert distribution by severity
    severity_counts = {}
    for severity in ["critical", "high", "warning", "info"]:
        count = db.query(Alert).filter(
            Alert.severity == severity,
            Alert.resolved == False,
        ).count()
        severity_counts[severity] = count

    # Risk distribution
    risk_counts = {}
    for risk in ["critical", "high", "moderate", "low", "unknown"]:
        count = db.query(Patient).filter(Patient.risk_level == risk).count()
        if count > 0:
            risk_counts[risk] = count

    # Ward overview
    wards = (
        db.query(
            Patient.ward,
            func.count(Patient.id).label("patient_count"),
            func.avg(Patient.data_quality_score).label("avg_dq"),
        )
        .group_by(Patient.ward)
        .all()
    )
    ward_stats = [
        {"ward": w[0], "patients": w[1], "avg_dq_score": round(w[2] or 100, 1)}
        for w in wards
    ]

    # Recent alerts
    recent_alerts = (
        db.query(Alert)
        .filter(Alert.resolved == False)
        .order_by(Alert.created_at.desc())
        .limit(10)
        .all()
    )
    recent = [
        {
            "id": a.id,
            "patient_id": a.patient_id,
            "severity": a.severity,
            "alert_type": a.alert_type,
            "message": a.message[:120],
            "tier": a.tier,
            "created_at": a.created_at.isoformat() if a.created_at else None,
        }
        for a in recent_alerts
    ]

    return {
        "total_patients": total_patients,
        "active_alerts": total_alerts,
        "avg_data_quality_score": round(avg_dq, 1),
        "severity_distribution": severity_counts,
        "risk_distribution": risk_counts,
        "ward_overview": ward_stats,
        "recent_alerts": recent,
    }
