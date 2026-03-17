"""CareAI Database Models and Initialization"""
from datetime import datetime, date
from sqlalchemy import (
    create_engine, Column, Integer, String, Float, Boolean,
    Text, DateTime, Date, JSON, ForeignKey, Index
)
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
from config import DATABASE_URL

Base = declarative_base()
engine = create_engine(DATABASE_URL, echo=False, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


def get_db():
    """Dependency for FastAPI route injection."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class Patient(Base):
    __tablename__ = "patients"

    id = Column(Integer, primary_key=True, index=True)
    medical_record_number = Column(String(50), unique=True, index=True)
    name = Column(String(200), nullable=False)
    date_of_birth = Column(Date, nullable=False)
    gender = Column(String(10), nullable=False)  # male / female
    admission_date = Column(Date, nullable=False)
    discharge_date = Column(Date, nullable=True)
    ward = Column(String(100), default="Pediatrics")
    room = Column(String(50), nullable=True)
    diagnosis = Column(Text, nullable=True)
    admission_weight_kg = Column(Float, nullable=True)
    admission_height_cm = Column(Float, nullable=True)
    risk_level = Column(String(20), default="unknown")  # low / moderate / high / critical
    data_quality_score = Column(Float, default=100.0)
    created_at = Column(DateTime, default=datetime.utcnow)

    observations = relationship("Observation", back_populates="patient", cascade="all, delete-orphan")
    clinical_notes = relationship("ClinicalNote", back_populates="patient", cascade="all, delete-orphan")
    alerts = relationship("Alert", back_populates="patient", cascade="all, delete-orphan")
    fhir_exports = relationship("FHIRExport", back_populates="patient", cascade="all, delete-orphan")

    @property
    def age_days(self):
        ref = self.discharge_date or date.today()
        return (ref - self.date_of_birth).days

    @property
    def age_months(self):
        return self.age_days / 30.4375

    @property
    def age_years(self):
        return self.age_days / 365.25


class Observation(Base):
    __tablename__ = "observations"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False, index=True)
    type = Column(String(50), nullable=False)  # weight, height, bmi, head_circ, lab
    value = Column(Float, nullable=False)
    unit = Column(String(20), nullable=False)  # kg, cm, kg/m2, cm, etc.
    effective_date = Column(DateTime, nullable=False)
    source = Column(String(100), default="manual")  # manual, device, import
    zscore = Column(Float, nullable=True)
    zscore_interpretation = Column(String(50), nullable=True)
    data_quality_score = Column(Float, default=100.0)
    is_error = Column(Boolean, default=False)  # ground truth for synthetic evaluation
    error_type = Column(String(50), nullable=True)  # for synthetic evaluation
    created_at = Column(DateTime, default=datetime.utcnow)

    patient = relationship("Patient", back_populates="observations")
    alerts = relationship("Alert", back_populates="observation", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_obs_patient_type_date", "patient_id", "type", "effective_date"),
    )


class ClinicalNote(Base):
    __tablename__ = "clinical_notes"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False, index=True)
    content = Column(Text, nullable=False)
    author = Column(String(200), default="System")
    note_type = Column(String(50), default="progress")  # admission, progress, discharge, nutrition
    effective_date = Column(DateTime, nullable=False)
    extracted_signals = Column(JSON, nullable=True)  # NLP extracted keywords
    created_at = Column(DateTime, default=datetime.utcnow)

    patient = relationship("Patient", back_populates="clinical_notes")


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False, index=True)
    observation_id = Column(Integer, ForeignKey("observations.id"), nullable=True)
    tier = Column(String(10), nullable=False)  # tier1, tier2
    severity = Column(String(20), nullable=False)  # critical, high, warning, info
    alert_type = Column(String(50), nullable=False)  # UNIT_CONFUSION, DECIMAL_ERROR, etc.
    message = Column(Text, nullable=False)
    explanation = Column(Text, nullable=True)
    resolved = Column(Boolean, default=False)
    resolved_by = Column(String(200), nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    patient = relationship("Patient", back_populates="alerts")
    observation = relationship("Observation", back_populates="alerts")

    __table_args__ = (
        Index("ix_alert_severity_resolved", "severity", "resolved"),
    )


class FHIRExport(Base):
    __tablename__ = "fhir_exports"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False, index=True)
    resource_type = Column(String(50), nullable=False)  # Observation, NutritionOrder, Bundle
    fhir_json = Column(JSON, nullable=False)
    version = Column(String(20), default="R5")
    created_at = Column(DateTime, default=datetime.utcnow)

    patient = relationship("Patient", back_populates="fhir_exports")


def init_db():
    """Create all tables."""
    Base.metadata.create_all(bind=engine)
    print("[DB] All tables created successfully.")


if __name__ == "__main__":
    init_db()
