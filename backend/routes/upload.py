"""Upload routes – CSV/JSON data import."""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import List, Optional
from sqlalchemy.orm import Session
from datetime import datetime
from database import get_db, Patient, Observation, ClinicalNote

router = APIRouter()


class ObservationInput(BaseModel):
    type: str  # weight, height, bmi
    value: float
    unit: str
    effective_date: str


class NoteInput(BaseModel):
    content: str
    note_type: str = "progress"
    author: str = "System"
    effective_date: str


class PatientInput(BaseModel):
    medical_record_number: str
    name: str
    date_of_birth: str
    gender: str
    admission_date: str
    ward: str = "Pediatrics"
    room: Optional[str] = None
    diagnosis: Optional[str] = None
    observations: List[ObservationInput] = []
    notes: List[NoteInput] = []


@router.post("/upload/patient")
async def upload_patient(data: PatientInput, db: Session = Depends(get_db)):
    """Upload a single patient with observations and notes."""
    patient = Patient(
        medical_record_number=data.medical_record_number,
        name=data.name,
        date_of_birth=datetime.fromisoformat(data.date_of_birth).date(),
        gender=data.gender,
        admission_date=datetime.fromisoformat(data.admission_date).date(),
        ward=data.ward,
        room=data.room,
        diagnosis=data.diagnosis,
    )
    db.add(patient)
    db.flush()

    for obs in data.observations:
        db.add(Observation(
            patient_id=patient.id,
            type=obs.type,
            value=obs.value,
            unit=obs.unit,
            effective_date=datetime.fromisoformat(obs.effective_date),
            source="upload",
        ))

    for note in data.notes:
        db.add(ClinicalNote(
            patient_id=patient.id,
            content=note.content,
            note_type=note.note_type,
            author=note.author,
            effective_date=datetime.fromisoformat(note.effective_date),
        ))

    db.commit()

    return {"status": "created", "patient_id": patient.id, "name": patient.name}
