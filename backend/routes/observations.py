"""Observation routes."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db, Observation

router = APIRouter()


@router.get("/observations/{patient_id}")
async def get_observations(patient_id: int, obs_type: str = None, db: Session = Depends(get_db)):
    """Get observation history for a patient."""
    query = db.query(Observation).filter(Observation.patient_id == patient_id)
    if obs_type:
        query = query.filter(Observation.type == obs_type)
    observations = query.order_by(Observation.effective_date).all()

    return {
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
        ]
    }
