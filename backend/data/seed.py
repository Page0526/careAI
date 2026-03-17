"""Database Seeder – Populate database with synthetic data."""
from database import init_db, SessionLocal, Patient, Observation, ClinicalNote
from data.synthetic_generator import generate_patient_cohort


def seed_database():
    """Generate synthetic patients and insert into database."""
    init_db()
    db = SessionLocal()

    # Check if already seeded
    existing = db.query(Patient).count()
    if existing > 0:
        print(f"[Seed] Database already has {existing} patients. Skipping.")
        db.close()
        return

    print("[Seed] Generating synthetic patient cohort...")
    patients = generate_patient_cohort()

    for p_data in patients:
        patient = Patient(
            medical_record_number=p_data["medical_record_number"],
            name=p_data["name"],
            date_of_birth=p_data["date_of_birth"],
            gender=p_data["gender"],
            admission_date=p_data["admission_date"],
            ward=p_data["ward"],
            room=p_data["room"],
            diagnosis=p_data["diagnosis"],
            admission_weight_kg=p_data["admission_weight_kg"],
            admission_height_cm=p_data["admission_height_cm"],
        )
        db.add(patient)
        db.flush()  # Get patient.id

        # Add observations
        for obs_data in p_data.get("observations", []):
            obs = Observation(
                patient_id=patient.id,
                type=obs_data["type"],
                value=obs_data["value"],
                unit=obs_data["unit"],
                effective_date=obs_data["date"],
                source="synthetic",
                is_error=obs_data.get("is_error", False),
                error_type=obs_data.get("error_type"),
            )
            db.add(obs)

        # Add clinical notes
        for note_data in p_data.get("notes", []):
            note = ClinicalNote(
                patient_id=patient.id,
                content=note_data["content"],
                note_type=note_data["note_type"],
                effective_date=note_data["date"],
                author=note_data["author"],
            )
            db.add(note)

    db.commit()
    print(f"[Seed] Created {len(patients)} patients with observations and notes.")
    db.close()


if __name__ == "__main__":
    seed_database()
