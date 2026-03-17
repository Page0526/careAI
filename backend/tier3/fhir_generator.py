"""Tier 3: FHIR Resource Generators

Generates HL7 FHIR R5 resources for validated patient data:
- Observation (weight, height, BMI, z-scores)
- NutritionOrder
- NutritionIntake
- Bundle (collection of all resources)
"""
import json
import uuid
from datetime import datetime
from typing import Dict, List, Optional
from sqlalchemy.orm import Session
from database import Patient, Observation, ClinicalNote, FHIRExport


def generate_patient_fhir(patient_id: int, db: Session) -> Dict:
    """Generate complete FHIR Patient resource."""
    from database import Patient
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        return {}

    return {
        "resourceType": "Patient",
        "id": str(uuid.uuid4()),
        "identifier": [{
            "system": "urn:careai:mrn",
            "value": patient.medical_record_number,
        }],
        "name": [{
            "text": patient.name,
            "family": patient.name.split()[0] if patient.name else "",
            "given": patient.name.split()[1:] if patient.name else [],
        }],
        "gender": patient.gender,
        "birthDate": patient.date_of_birth.isoformat(),
    }


def generate_observation_fhir(obs: Observation, patient: Patient) -> Dict:
    """Generate FHIR Observation resource for a measurement."""
    # Map type to LOINC codes
    loinc_map = {
        "weight": {"code": "29463-7", "display": "Body weight", "unit": "kg", "system_unit": "http://unitsofmeasure.org", "unit_code": "kg"},
        "height": {"code": "8302-2", "display": "Body height", "unit": "cm", "system_unit": "http://unitsofmeasure.org", "unit_code": "cm"},
        "bmi": {"code": "39156-5", "display": "Body mass index", "unit": "kg/m2", "system_unit": "http://unitsofmeasure.org", "unit_code": "kg/m2"},
    }

    loinc = loinc_map.get(obs.type, loinc_map["weight"])

    resource = {
        "resourceType": "Observation",
        "id": str(uuid.uuid4()),
        "status": "final",
        "category": [{
            "coding": [{
                "system": "http://terminology.hl7.org/CodeSystem/observation-category",
                "code": "vital-signs",
                "display": "Vital Signs",
            }]
        }],
        "code": {
            "coding": [{
                "system": "http://loinc.org",
                "code": loinc["code"],
                "display": loinc["display"],
            }]
        },
        "subject": {
            "reference": f"Patient/{patient.medical_record_number}",
            "display": patient.name,
        },
        "effectiveDateTime": obs.effective_date.isoformat() if isinstance(obs.effective_date, datetime) else obs.effective_date,
        "valueQuantity": {
            "value": obs.value,
            "unit": loinc["unit"],
            "system": loinc["system_unit"],
            "code": loinc["unit_code"],
        },
    }

    # Add z-score as component if available
    if obs.zscore is not None:
        resource["component"] = [{
            "code": {
                "coding": [{
                    "system": "http://loinc.org",
                    "code": "8336-0" if obs.type == "weight" else "8302-2",
                    "display": f"{loinc['display']} z-score",
                }]
            },
            "valueQuantity": {
                "value": obs.zscore,
                "unit": "SD",
                "system": "http://unitsofmeasure.org",
            },
        }]

    # Add data quality extension
    resource["extension"] = [{
        "url": "urn:careai:data-quality-score",
        "valueDecimal": obs.data_quality_score,
    }]

    return resource


def generate_nutrition_order_fhir(patient: Patient) -> Dict:
    """Generate FHIR NutritionOrder based on patient context."""
    age_months = patient.age_months

    # Determine diet type based on age
    if age_months < 6:
        diet_type = "Breast milk / Infant formula"
        texture = "Liquid"
        oral_diet_code = "160670007"
    elif age_months < 12:
        diet_type = "Complementary feeding + formula/breast milk"
        texture = "Puree / Soft"
        oral_diet_code = "182954008"
    elif age_months < 24:
        diet_type = "Toddler diet – age-appropriate texture"
        texture = "Soft / Regular"
        oral_diet_code = "182954008"
    else:
        diet_type = "Regular pediatric diet"
        texture = "Regular"
        oral_diet_code = "182954008"

    return {
        "resourceType": "NutritionOrder",
        "id": str(uuid.uuid4()),
        "status": "active",
        "intent": "order",
        "subject": {
            "reference": f"Patient/{patient.medical_record_number}",
            "display": patient.name,
        },
        "dateTime": datetime.utcnow().isoformat(),
        "orderer": {
            "display": "CareAI System (auto-generated)",
        },
        "oralDiet": {
            "type": [{
                "coding": [{
                    "system": "http://snomed.info/sct",
                    "code": oral_diet_code,
                    "display": diet_type,
                }],
                "text": diet_type,
            }],
            "texture": [{
                "modifier": {
                    "text": texture,
                },
            }],
            "instruction": f"Age-appropriate diet for {age_months:.0f}-month-old. Monitor intake and tolerance.",
        },
    }


def generate_nutrition_intake_fhir(patient: Patient) -> Dict:
    """Generate FHIR NutritionIntake resource."""
    return {
        "resourceType": "NutritionIntake",
        "id": str(uuid.uuid4()),
        "status": "completed",
        "subject": {
            "reference": f"Patient/{patient.medical_record_number}",
            "display": patient.name,
        },
        "occurrencePeriod": {
            "start": patient.admission_date.isoformat(),
            "end": datetime.utcnow().date().isoformat(),
        },
        "consumedItem": [{
            "type": {
                "coding": [{
                    "system": "http://snomed.info/sct",
                    "code": "226379006",
                    "display": "Food intake",
                }],
            },
            "nutritionProduct": {
                "concept": {
                    "text": "Hospital diet – as ordered",
                },
            },
            "schedule": {
                "timing": [{
                    "repeat": {
                        "frequency": 3,
                        "period": 1,
                        "periodUnit": "d",
                    },
                }],
            },
        }],
    }


def generate_fhir_bundle(patient_id: int, db: Session) -> Dict:
    """Generate complete FHIR Bundle for a patient."""
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        return {"resourceType": "Bundle", "type": "collection", "entry": []}

    observations = (
        db.query(Observation)
        .filter(Observation.patient_id == patient_id)
        .order_by(Observation.effective_date)
        .all()
    )

    entries = []

    # Patient resource
    patient_resource = generate_patient_fhir(patient_id, db)
    entries.append({"resource": patient_resource})

    # Observation resources (only for non-errored data with quality score > 50)
    for obs in observations:
        if obs.data_quality_score >= 50:
            obs_resource = generate_observation_fhir(obs, patient)
            entries.append({"resource": obs_resource})

    # NutritionOrder
    nutrition_order = generate_nutrition_order_fhir(patient)
    entries.append({"resource": nutrition_order})

    # NutritionIntake
    nutrition_intake = generate_nutrition_intake_fhir(patient)
    entries.append({"resource": nutrition_intake})

    bundle = {
        "resourceType": "Bundle",
        "id": str(uuid.uuid4()),
        "type": "collection",
        "timestamp": datetime.utcnow().isoformat(),
        "total": len(entries),
        "entry": entries,
        "meta": {
            "tag": [{
                "system": "urn:careai",
                "code": "validated",
                "display": f"CareAI validated bundle - DQ Score: {patient.data_quality_score}",
            }],
        },
    }

    # Save to database
    export = FHIRExport(
        patient_id=patient_id,
        resource_type="Bundle",
        fhir_json=bundle,
    )
    db.add(export)
    db.commit()

    return bundle
