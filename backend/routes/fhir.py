"""FHIR routes – export validated data as FHIR resources."""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from database import get_db, FHIRExport
from tier3.fhir_generator import generate_fhir_bundle

router = APIRouter()


@router.get("/fhir/{patient_id}")
async def get_fhir_bundle(patient_id: int, db: Session = Depends(get_db)):
    """Generate and return FHIR Bundle for a patient."""
    bundle = generate_fhir_bundle(patient_id, db)
    if not bundle.get("entry"):
        raise HTTPException(status_code=404, detail="Patient not found or no valid observations")
    return bundle


@router.get("/fhir/{patient_id}/download")
async def download_fhir(patient_id: int, db: Session = Depends(get_db)):
    """Download FHIR Bundle as JSON file."""
    bundle = generate_fhir_bundle(patient_id, db)
    if not bundle.get("entry"):
        raise HTTPException(status_code=404, detail="Patient not found")

    return JSONResponse(
        content=bundle,
        headers={
            "Content-Disposition": f'attachment; filename="careai_fhir_patient_{patient_id}.json"'
        },
    )


@router.get("/fhir/exports/list")
async def list_exports(db: Session = Depends(get_db)):
    """List all FHIR exports."""
    exports = db.query(FHIRExport).order_by(FHIRExport.created_at.desc()).all()
    return {
        "exports": [
            {
                "id": e.id,
                "patient_id": e.patient_id,
                "resource_type": e.resource_type,
                "version": e.version,
                "created_at": e.created_at.isoformat() if e.created_at else None,
            }
            for e in exports
        ]
    }
