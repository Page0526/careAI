import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
import httpx

BASE = "http://localhost:8000/hackathon/api"
c = httpx.Client(timeout=30)

# Debug Patient 1 alerts
print("=== Patient 1 Alerts ===")
r = c.post(f"{BASE}/validate/1")
d = r.json()
print(f"DQ={d['data_quality_score']}, Risk={d['risk_level']}")
print(f"Tier1={d['tier1_alerts']}, Tier2={d['tier2_alerts']}")
for i, a in enumerate(d['alerts']):
    print(f"  {i+1}. [{a['severity']}] {a['alert_type']}: {a['message'][:100]}")

# Test other scenarios
for pid in [7, 10, 13, 16, 20, 25]:
    r = c.post(f"{BASE}/validate/{pid}")
    d = r.json()
    print(f"\nP{pid} ({d['patient_name']}): DQ={d['data_quality_score']}, Risk={d['risk_level']}, Alerts={d['total_alerts']}")

# Dashboard
print("\n=== Dashboard ===")
r = c.get(f"{BASE}/dashboard/stats")
d = r.json()
print(f"Patients={d['total_patients']}, Alerts={d['active_alerts']}, AvgDQ={d['avg_data_quality_score']}")
print(f"Severity: {d['severity_distribution']}")

# FHIR
print("\n=== FHIR ===")
r = c.get(f"{BASE}/fhir/1")
d = r.json()
print(f"Type={d['resourceType']}, Entries={d['total']}")

# Agent
print("\n=== Agent ===")
r = c.post(f"{BASE}/agent/chat", json={"message": "What can you do?", "patient_id": None})
d = r.json()
print(f"Model={d['model']}, Response={d['response'][:150]}")

print("\nDONE")
