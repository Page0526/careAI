const API_BASE = "/hackathon/api";

export async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  if (!res.ok) throw new Error(`API Error: ${res.status}`);
  return res.json();
}

export const api = {
  dashboard: () => apiFetch("/dashboard/stats"),
  patients: (params?: string) => apiFetch(`/patients${params ? `?${params}` : ""}`),
  patient: (id: number) => apiFetch(`/patients/${id}`),
  validate: (id: number) => apiFetch(`/validate/${id}`, { method: "POST" }),
  validateBatch: () => apiFetch("/validate/batch", { method: "POST" }),
  alerts: (params?: string) => apiFetch(`/alerts${params ? `?${params}` : ""}`),
  resolveAlert: (id: number) => apiFetch(`/alerts/${id}/resolve`, { method: "PATCH" }),
  fhir: (id: number) => apiFetch(`/fhir/${id}`),
  agentChat: (message: string, patientId?: number) =>
    apiFetch("/agent/chat", {
      method: "POST",
      body: JSON.stringify({ message, patient_id: patientId }),
    }),
};
