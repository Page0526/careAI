"""Synthetic Pediatric Patient Data Generator

Generates realistic pediatric patient records with:
- Normal patients (no errors)
- Patients with injected data quality errors
- Clinical notes with embedded signals for NLP testing
"""
import random
import math
from datetime import datetime, timedelta, date
from typing import List, Dict, Tuple
from tier1.zscore import get_median_weight, get_median_height


# Vietnamese names
FIRST_NAMES_MALE = [
    "Minh", "Hoàng", "Đức", "Tuấn", "Anh", "Huy", "Khang", "Bảo",
    "Nam", "Long", "Phúc", "Quang", "Duy", "Thành", "Khoa",
]
FIRST_NAMES_FEMALE = [
    "Linh", "Hương", "Ngọc", "Trang", "Mai", "Hà", "Lan",
    "Thảo", "Phương", "An", "Chi", "Vy", "Nhi", "Trâm", "Hạnh",
]
LAST_NAMES = [
    "Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Huỳnh", "Phan",
    "Vũ", "Võ", "Đặng", "Bùi", "Đỗ", "Hồ", "Ngô", "Dương",
]
MIDDLE_NAMES = ["Văn", "Thị", "Đức", "Minh", "Thanh", "Hữu", "Quốc", "Hoàng"]

WARDS = ["Nhi A", "Nhi B", "Nhi ICU", "Nhi Sơ Sinh", "Nhi Tổng Hợp"]
ROOMS = ["101", "102", "103", "201", "202", "203", "301", "ICU-1", "ICU-2"]

DIAGNOSES = [
    "Viêm phổi (Pneumonia)",
    "Viêm phế quản cấp (Acute Bronchitis)",
    "Tiêu chảy cấp (Acute Diarrhea)",
    "Suy dinh dưỡng (Malnutrition)",
    "Hen phế quản (Asthma)",
    "Sốt xuất huyết (Dengue Fever)",
    "Nhiễm trùng đường tiết niệu (UTI)",
    "Viêm dạ dày ruột (Gastroenteritis)",
    "Viêm tai giữa (Otitis Media)",
    "Co giật do sốt (Febrile Seizure)",
]

# ────────────────────────────────────────────────────────────
# Clinical Note Templates
# ────────────────────────────────────────────────────────────

ADMISSION_NOTES = [
    "Patient admitted with {diagnosis}. Weight on admission: {weight} kg, Height: {height} cm. "
    "General appearance: {appearance}. Vital signs stable. Started on {treatment}.",

    "Admitted via ER for {diagnosis}. Current weight: {weight} kg. "
    "Nutritional screening completed. {nutrition_status}. Plan: {treatment}.",
]

PROGRESS_NOTES_NORMAL = [
    "Day {day}: Patient improving. Tolerating oral feeds well. Weight: {weight} kg. "
    "Vital signs within normal limits. Continue current management.",

    "Day {day}: Stable condition. Good oral intake. Weight {weight} kg. "
    "No fever. Active, playful. Plan: continue treatment, monitor.",
]

PROGRESS_NOTES_EDEMA = [
    "Day {day}: Noted peripheral edema in lower extremities. Weight up to {weight} kg "
    "from {prev_weight} kg. Fluid overload suspected. Will consider fluid restriction.",

    "Day {day}: Weight {weight} kg (+{delta} kg). Facial puffiness noted, "
    "pitting edema bilateral legs. Positive fluid balance. Reviewing IV rate.",
]

PROGRESS_NOTES_POOR_INTAKE = [
    "Day {day}: Poor oral intake today. Refused morning feeds. Weight: {weight} kg. "
    "NPO for procedure preparation. Will reassess nutrition plan.",

    "Day {day}: Patient not eating well, poor appetite since yesterday. "
    "Feeding intolerance noted. Weight {weight} kg. Consider NG tube if no improvement.",
]

PROGRESS_NOTES_DIURETIC = [
    "Day {day}: Started furosemide 1mg/kg. Weight {weight} kg. "
    "Monitoring fluid balance and electrolytes. Urine output adequate.",

    "Day {day}: On diuretic therapy (furosemide). Good diuresis. "
    "Weight {weight} kg. I/O balance negative. Electrolytes pending.",
]

PROGRESS_NOTES_VOMITING = [
    "Day {day}: Multiple episodes of vomiting. Unable to tolerate oral feeds. "
    "Weight {weight} kg. Started IV fluids. Antiemetic given.",

    "Day {day}: Persistent emesis, 4 episodes since morning. Weight {weight} kg. "
    "NPO, on IV maintenance. Nauseous. Plan: continue antiemetics, reassess.",
]

DISCHARGE_NOTES = [
    "Discharged after {days} days. Final weight: {weight} kg. Diagnosis: {diagnosis}. "
    "Condition improved. Follow-up in 1 week. Diet: age-appropriate, advised increased intake.",
]


def generate_name(gender: str) -> str:
    last = random.choice(LAST_NAMES)
    middle = random.choice(MIDDLE_NAMES)
    if gender == "male":
        first = random.choice(FIRST_NAMES_MALE)
    else:
        first = random.choice(FIRST_NAMES_FEMALE)
    return f"{last} {middle} {first}"


def generate_patient_cohort() -> List[Dict]:
    """Generate 28 patient records with varied scenarios."""
    patients = []
    scenario_counter = 0

    scenarios = [
        # (count, scenario_type, description)
        (6, "normal", "Normal trajectory, no errors"),
        (4, "unit_error", "Unit confusion errors injected"),
        (3, "decimal_error", "Decimal placement errors"),
        (3, "duplicate", "Duplicate/carried-forward values"),
        (3, "trajectory", "Implausible trajectory"),
        (4, "context_contradiction", "Notes contradict structured data"),
        (3, "mixed", "Multiple error types"),
        (2, "malnutrition_mismatch", "Diagnosis-anthropometric mismatch"),
    ]

    for count, scenario, desc in scenarios:
        for i in range(count):
            scenario_counter += 1
            gender = random.choice(["male", "female"])
            age_months = random.choice([1, 3, 6, 8, 12, 18, 24, 36, 48, 60, 72, 84, 96, 108, 120])
            dob = date.today() - timedelta(days=int(age_months * 30.4375))
            admission_days = random.randint(5, 20)
            admission_date = date.today() - timedelta(days=admission_days)

            median_w = get_median_weight(age_months, gender)
            median_h = get_median_height(age_months, gender)
            # Normal variation: ±15% of median
            base_w = median_w * random.uniform(0.85, 1.15)
            base_h = median_h * random.uniform(0.95, 1.05)

            patient = {
                "id": scenario_counter,
                "medical_record_number": f"MRN-2026-{scenario_counter:04d}",
                "name": generate_name(gender),
                "date_of_birth": dob,
                "gender": gender,
                "admission_date": admission_date,
                "ward": random.choice(WARDS),
                "room": random.choice(ROOMS),
                "diagnosis": random.choice(DIAGNOSES),
                "admission_weight_kg": round(base_w, 2),
                "admission_height_cm": round(base_h, 1),
                "scenario": scenario,
                "scenario_desc": desc,
                "observations": [],
                "notes": [],
            }

            # Generate observations and notes based on scenario
            _generate_observations(patient, scenario, admission_days, age_months, base_w, base_h, gender)
            _generate_notes(patient, scenario, admission_days, base_w)

            patients.append(patient)

    return patients


def _generate_observations(
    patient: Dict, scenario: str, days: int,
    age_months: float, base_w: float, base_h: float, gender: str
):
    """Generate observation sequence for a patient based on scenario."""
    obs = []
    admission = patient["admission_date"]

    if scenario == "normal":
        # Normal daily weights with slight physiological variation
        for d in range(days):
            daily_change = random.uniform(-0.05, 0.08)  # Small daily variation
            w = round(base_w + (d * daily_change), 2)
            obs.append({
                "type": "weight", "value": w, "unit": "kg",
                "date": datetime.combine(admission + timedelta(days=d), datetime.min.time().replace(hour=7)),
                "is_error": False, "error_type": None,
            })
        # Heights measured every 5 days
        for d in range(0, days, 5):
            obs.append({
                "type": "height", "value": round(base_h + random.uniform(-0.2, 0.3), 1), "unit": "cm",
                "date": datetime.combine(admission + timedelta(days=d), datetime.min.time().replace(hour=7, minute=30)),
                "is_error": False, "error_type": None,
            })

    elif scenario == "unit_error":
        for d in range(days):
            w = round(base_w + random.uniform(-0.1, 0.1), 2)
            is_error = (d == random.randint(2, days - 2))
            if is_error:
                # Enter lb value as kg
                w = round(base_w * 2.20462, 2)
            obs.append({
                "type": "weight", "value": w, "unit": "kg",
                "date": datetime.combine(admission + timedelta(days=d), datetime.min.time().replace(hour=7)),
                "is_error": is_error, "error_type": "UNIT_CONFUSION" if is_error else None,
            })
        obs.append({
            "type": "height", "value": round(base_h, 1), "unit": "cm",
            "date": datetime.combine(admission, datetime.min.time().replace(hour=7, minute=30)),
            "is_error": False, "error_type": None,
        })

    elif scenario == "decimal_error":
        error_day = random.randint(2, days - 2)
        for d in range(days):
            w = round(base_w + random.uniform(-0.1, 0.1), 2)
            is_error = (d == error_day)
            if is_error:
                w = round(base_w / 10, 2)  # 50kg → 5.0kg
            obs.append({
                "type": "weight", "value": w, "unit": "kg",
                "date": datetime.combine(admission + timedelta(days=d), datetime.min.time().replace(hour=7)),
                "is_error": is_error, "error_type": "DECIMAL_ERROR" if is_error else None,
            })
        obs.append({
            "type": "height", "value": round(base_h, 1), "unit": "cm",
            "date": datetime.combine(admission, datetime.min.time().replace(hour=7, minute=30)),
            "is_error": False, "error_type": None,
        })

    elif scenario == "duplicate":
        fixed_w = round(base_w, 2)
        for d in range(days):
            is_dup = (3 <= d <= 3 + CARRIED_FORWARD_STREAK)
            w = fixed_w if is_dup else round(base_w + random.uniform(-0.1, 0.1), 2)
            obs.append({
                "type": "weight", "value": w, "unit": "kg",
                "date": datetime.combine(admission + timedelta(days=d), datetime.min.time().replace(hour=7)),
                "is_error": is_dup, "error_type": "CARRIED_FORWARD" if is_dup else None,
            })
        obs.append({
            "type": "height", "value": round(base_h, 1), "unit": "cm",
            "date": datetime.combine(admission, datetime.min.time().replace(hour=7, minute=30)),
            "is_error": False, "error_type": None,
        })

    elif scenario == "trajectory":
        spike_day = random.randint(3, days - 3)
        for d in range(days):
            w = round(base_w + random.uniform(-0.05, 0.05), 2)
            is_error = (d == spike_day)
            if is_error:
                w = round(base_w + base_w * 0.25, 2)  # 25% jump
            obs.append({
                "type": "weight", "value": w, "unit": "kg",
                "date": datetime.combine(admission + timedelta(days=d), datetime.min.time().replace(hour=7)),
                "is_error": is_error, "error_type": "IMPLAUSIBLE_VEL" if is_error else None,
            })
        obs.append({
            "type": "height", "value": round(base_h, 1), "unit": "cm",
            "date": datetime.combine(admission, datetime.min.time().replace(hour=7, minute=30)),
            "is_error": False, "error_type": None,
        })

    elif scenario == "context_contradiction":
        # Weight goes UP but notes mention edema/fluid overload
        for d in range(days):
            w = round(base_w + d * 0.15, 2)  # Steady weight gain (~150g/day)
            obs.append({
                "type": "weight", "value": w, "unit": "kg",
                "date": datetime.combine(admission + timedelta(days=d), datetime.min.time().replace(hour=7)),
                "is_error": False, "error_type": None,
            })
        obs.append({
            "type": "height", "value": round(base_h, 1), "unit": "cm",
            "date": datetime.combine(admission, datetime.min.time().replace(hour=7, minute=30)),
            "is_error": False, "error_type": None,
        })

    elif scenario == "malnutrition_mismatch":
        # Normal weight z-score but diagnosis says malnutrition
        patient["diagnosis"] = "Suy dinh dưỡng (Malnutrition)"
        for d in range(days):
            w = round(base_w + random.uniform(-0.05, 0.05), 2)
            obs.append({
                "type": "weight", "value": w, "unit": "kg",
                "date": datetime.combine(admission + timedelta(days=d), datetime.min.time().replace(hour=7)),
                "is_error": False, "error_type": None,
            })
        obs.append({
            "type": "height", "value": round(base_h, 1), "unit": "cm",
            "date": datetime.combine(admission, datetime.min.time().replace(hour=7, minute=30)),
            "is_error": False, "error_type": None,
        })

    elif scenario == "mixed":
        error_day_1 = 2
        error_day_2 = 5
        for d in range(days):
            w = round(base_w + random.uniform(-0.05, 0.05), 2)
            is_error = False
            e_type = None
            if d == error_day_1:
                w = round(base_w * 2.20462, 2)
                is_error = True
                e_type = "UNIT_CONFUSION"
            elif d == error_day_2:
                w = round(base_w / 10, 2)
                is_error = True
                e_type = "DECIMAL_ERROR"
            obs.append({
                "type": "weight", "value": w, "unit": "kg",
                "date": datetime.combine(admission + timedelta(days=d), datetime.min.time().replace(hour=7)),
                "is_error": is_error, "error_type": e_type,
            })
        obs.append({
            "type": "height", "value": round(base_h, 1), "unit": "cm",
            "date": datetime.combine(admission, datetime.min.time().replace(hour=7, minute=30)),
            "is_error": False, "error_type": None,
        })

    patient["observations"] = obs


# Constant for carried-forward streak length
CARRIED_FORWARD_STREAK = 4


def _generate_notes(patient: Dict, scenario: str, days: int, base_w: float):
    """Generate clinical notes based on scenario."""
    notes = []
    admission = patient["admission_date"]
    diagnosis = patient["diagnosis"]
    weight = patient["admission_weight_kg"]
    height = patient["admission_height_cm"]

    # Admission note
    template = random.choice(ADMISSION_NOTES)
    note_text = template.format(
        diagnosis=diagnosis,
        weight=weight,
        height=height,
        appearance=random.choice(["alert, active", "lethargic", "irritable", "drowsy but responsive"]),
        nutrition_status=random.choice(["Nutrition risk: low", "Moderate nutrition risk", "High nutrition risk"]),
        treatment=random.choice(["IV antibiotics", "supportive care", "IV fluids + monitoring", "oxygen therapy"]),
    )
    notes.append({
        "content": note_text,
        "note_type": "admission",
        "date": datetime.combine(admission, datetime.min.time().replace(hour=9)),
        "author": random.choice(["Dr. Nguyen", "Dr. Tran", "Dr. Le", "Dr. Pham"]),
    })

    # Progress notes
    for d in range(1, days - 1, 2):
        w = patient["observations"][min(d, len(patient["observations"]) - 1)]["value"] if patient["observations"] else weight

        if scenario == "context_contradiction":
            prev_w = patient["observations"][max(0, d - 1)]["value"] if d > 0 else weight
            template = random.choice(PROGRESS_NOTES_EDEMA)
            note_text = template.format(
                day=d, weight=round(w, 1), prev_weight=round(prev_w, 1),
                delta=round(w - prev_w, 2)
            )
        elif scenario == "normal" or scenario == "malnutrition_mismatch":
            template = random.choice(PROGRESS_NOTES_NORMAL)
            note_text = template.format(day=d, weight=round(w, 1))
        elif scenario in ("unit_error", "decimal_error", "trajectory", "mixed"):
            template = random.choice(PROGRESS_NOTES_NORMAL)
            note_text = template.format(day=d, weight=round(w, 1))
        elif scenario == "duplicate":
            # Mix of normal + poor intake notes
            if d >= 3:
                template = random.choice(PROGRESS_NOTES_POOR_INTAKE)
            else:
                template = random.choice(PROGRESS_NOTES_NORMAL)
            note_text = template.format(day=d, weight=round(w, 1))
        else:
            template = random.choice(PROGRESS_NOTES_NORMAL)
            note_text = template.format(day=d, weight=round(w, 1))

        # For malnutrition_mismatch, add malnutrition mention
        if scenario == "malnutrition_mismatch" and d == 3:
            note_text += " Assessment: moderate malnutrition, failure to thrive suspected."

        notes.append({
            "content": note_text,
            "note_type": "progress",
            "date": datetime.combine(admission + timedelta(days=d), datetime.min.time().replace(hour=10)),
            "author": random.choice(["Dr. Nguyen", "Dr. Tran", "NUT. Huyên", "NUT. Kim Mai"]),
        })

    # Discharge note
    template = random.choice(DISCHARGE_NOTES)
    final_w = patient["observations"][-2]["value"] if len(patient["observations"]) > 1 else weight
    note_text = template.format(days=days, weight=round(final_w, 1), diagnosis=diagnosis)
    notes.append({
        "content": note_text,
        "note_type": "discharge",
        "date": datetime.combine(admission + timedelta(days=days), datetime.min.time().replace(hour=14)),
        "author": random.choice(["Dr. Nguyen", "Dr. Tran"]),
    })

    patient["notes"] = notes
