"""AI Agent route – Groq-powered chat with SSE streaming."""
import json
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, List
from sqlalchemy.orm import Session
from database import get_db, Patient, Observation, ClinicalNote, Alert
from tier1.validator import run_tier1_validation
from tier2.contradiction import run_tier2_validation
from tier2.nlp_engine import extract_signals_with_context, get_signal_summary
from tier3.fhir_generator import generate_fhir_bundle
from tier1.zscore import calculate_zscore, interpret_zscore
from config import GROQ_API_KEY, GROQ_MODEL, GROQ_MAX_TOKENS, GROQ_TEMPERATURE

router = APIRouter()


class ChatRequest(BaseModel):
    message: str
    patient_id: Optional[int] = None
    conversation_history: List[dict] = []


SYSTEM_PROMPT = """You are CareAI Agent, a clinical data quality assistant for pediatric inpatient nutrition.

ROLE:
- You validate EHR data quality, NOT diagnose diseases
- You explain data anomalies and alerts in clinical context
- You help dietitians identify data inconsistencies between structured data and clinical notes
- You can explain FHIR resources and WHO growth standards

SAFETY:
- Never provide diagnosis or treatment recommendations
- Always recommend human review for critical findings
- Cite specific data points when explaining alerts
- Flag uncertainty explicitly

FORMAT:
- Use clear, structured responses with bullet points
- Highlight severity levels with emojis: 🔴 Critical, 🟠 High, 🟡 Warning, 🟢 Clean
- Include specific values and z-scores when discussing patient data
- Be concise but thorough"""


@router.post("/agent/chat")
async def agent_chat(request: ChatRequest, db: Session = Depends(get_db)):
    """Agent chat endpoint with Groq LLM."""

    # Build context based on patient if provided
    context = ""
    if request.patient_id:
        context = _build_patient_context(request.patient_id, db)

    # Build messages
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]

    if context:
        messages.append({"role": "system", "content": f"PATIENT CONTEXT:\n{context}"})

    # Add conversation history
    for msg in request.conversation_history[-6:]:  # Last 6 messages
        messages.append(msg)

    messages.append({"role": "user", "content": request.message})

    # Call Groq API
    if not GROQ_API_KEY:
        # Fallback: generate response without LLM
        response = _generate_fallback_response(request.message, request.patient_id, db)
        return {"response": response, "model": "fallback"}

    try:
        from groq import Groq
        client = Groq(api_key=GROQ_API_KEY)

        completion = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=messages,
            temperature=GROQ_TEMPERATURE,
            max_tokens=GROQ_MAX_TOKENS,
        )

        response_text = completion.choices[0].message.content
        return {
            "response": response_text,
            "model": GROQ_MODEL,
            "usage": {
                "prompt_tokens": completion.usage.prompt_tokens,
                "completion_tokens": completion.usage.completion_tokens,
            },
        }

    except Exception as e:
        # Fallback on error
        response = _generate_fallback_response(request.message, request.patient_id, db)
        return {"response": response, "model": "fallback", "error": str(e)}


def _build_patient_context(patient_id: int, db: Session) -> str:
    """Build patient context string for agent prompt."""
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        return "Patient not found."

    # Basic info
    context = f"""Patient: {patient.name}
MRN: {patient.medical_record_number}
DOB: {patient.date_of_birth} | Gender: {patient.gender} | Age: {patient.age_months:.0f} months
Ward: {patient.ward} | Room: {patient.room}
Diagnosis: {patient.diagnosis}
Admission: {patient.admission_date} | Weight: {patient.admission_weight_kg}kg | Height: {patient.admission_height_cm}cm
Data Quality Score: {patient.data_quality_score}/100 | Risk: {patient.risk_level}
"""

    # Recent observations
    observations = (
        db.query(Observation)
        .filter(Observation.patient_id == patient_id)
        .order_by(Observation.effective_date.desc())
        .limit(10)
        .all()
    )
    if observations:
        context += "\nRecent Observations:\n"
        for o in reversed(observations):
            z_info = f" (z={o.zscore:+.1f}, {o.zscore_interpretation})" if o.zscore else ""
            context += f"  {o.effective_date.strftime('%Y-%m-%d')}: {o.type}={o.value}{o.unit}{z_info}\n"

    # Active alerts
    alerts = (
        db.query(Alert)
        .filter(Alert.patient_id == patient_id, Alert.resolved == False)
        .all()
    )
    if alerts:
        context += "\nActive Alerts:\n"
        for a in alerts:
            context += f"  [{a.severity.upper()}] {a.alert_type}: {a.message}\n"

    # Clinical notes summary
    notes = (
        db.query(ClinicalNote)
        .filter(ClinicalNote.patient_id == patient_id)
        .order_by(ClinicalNote.effective_date.desc())
        .limit(3)
        .all()
    )
    if notes:
        context += "\nRecent Clinical Notes:\n"
        for n in reversed(notes):
            context += f"  [{n.note_type}] {n.effective_date.strftime('%Y-%m-%d')}: {n.content[:200]}\n"

    return context


def _generate_fallback_response(message: str, patient_id: int, db: Session) -> str:
    """Generate response without LLM (for when Groq API key is missing)."""
    msg_lower = message.lower()

    if patient_id:
        patient = db.query(Patient).filter(Patient.id == patient_id).first()
        if not patient:
            return "Patient not found."

        if "validate" in msg_lower:
            t1 = run_tier1_validation(patient, db)
            t2 = run_tier2_validation(patient, db)
            total = len(t1) + len(t2)
            return (
                f"✅ Validation complete for {patient.name}.\n\n"
                f"📊 Data Quality Score: {patient.data_quality_score}/100\n"
                f"⚠️ Alerts found: {total} (Tier 1: {len(t1)}, Tier 2: {len(t2)})\n"
                f"🏷️ Risk Level: {patient.risk_level}\n\n"
                f"Use the Alert Panel tab to review individual alerts."
            )

        if "growth" in msg_lower or "weight" in msg_lower or "z-score" in msg_lower:
            obs = (
                db.query(Observation)
                .filter(Observation.patient_id == patient_id, Observation.type == "weight")
                .order_by(Observation.effective_date)
                .all()
            )
            if obs:
                latest = obs[-1]
                return (
                    f"📈 Growth summary for {patient.name}:\n\n"
                    f"Latest weight: {latest.value} kg (z-score: {latest.zscore or 'N/A'})\n"
                    f"Measurements: {len(obs)} weight entries\n"
                    f"Trend: {obs[0].value}kg → {latest.value}kg over admission"
                )

        if "alert" in msg_lower or "flag" in msg_lower:
            alerts = db.query(Alert).filter(
                Alert.patient_id == patient_id, Alert.resolved == False
            ).all()
            if alerts:
                lines = [f"⚠️ Active alerts for {patient.name}:\n"]
                for a in alerts:
                    icon = {"critical": "🔴", "high": "🟠", "warning": "🟡"}.get(a.severity, "ℹ️")
                    lines.append(f"{icon} [{a.alert_type}] {a.message}")
                return "\n".join(lines)
            return f"✅ No active alerts for {patient.name}."

    return (
        "👋 I'm CareAI Agent! I can help you:\n\n"
        "• **Validate patient data** – Check for errors and inconsistencies\n"
        "• **Analyze growth trends** – Review weight/height trajectories\n"
        "• **Explain alerts** – Understand why data was flagged\n"
        "• **Export FHIR** – Generate standardized data exports\n\n"
        "Select a patient and ask me anything about their data quality!"
    )
