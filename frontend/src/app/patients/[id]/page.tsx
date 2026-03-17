"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";

interface PatientDetail {
  patient: { id: number; name: string; medical_record_number: string; date_of_birth: string; gender: string; age_months: number; age_years: number; ward: string; room: string; diagnosis: string; admission_date: string; admission_weight_kg: number; admission_height_cm: number; risk_level: string; data_quality_score: number; };
  observations: { id: number; type: string; value: number; unit: string; effective_date: string; zscore: number | null; zscore_interpretation: string | null; data_quality_score: number; }[];
  notes: { id: number; content: string; note_type: string; author: string; effective_date: string; extracted_signals: Record<string, string[]> | null; }[];
  alerts: { id: number; tier: string; severity: string; alert_type: string; message: string; explanation: string; resolved: boolean; created_at: string; }[];
}

const severityIcon: Record<string, string> = { critical: "🔴", high: "🟠", warning: "🟡", info: "🔵" };
const noteTypeIcon: Record<string, string> = { admission: "📋", progress: "📝", discharge: "✅", nutrition: "🍽️" };

export default function PatientDetailPage() {
  const params = useParams();
  const patientId = Number(params.id);
  const [data, setData] = useState<PatientDetail | null>(null);
  const [tab, setTab] = useState<"growth" | "alerts" | "notes" | "fhir" | "agent">("growth");
  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(false);
  const [fhirData, setFhirData] = useState<object | null>(null);
  const [agentMsg, setAgentMsg] = useState("");
  const [agentChat, setAgentChat] = useState<{ role: string; content: string }[]>([]);
  const [agentLoading, setAgentLoading] = useState(false);

  useEffect(() => {
    api.patient(patientId).then((d) => { setData(d); setLoading(false); });
  }, [patientId]);

  const runValidation = async () => {
    setValidating(true);
    await api.validate(patientId);
    const d = await api.patient(patientId);
    setData(d);
    setValidating(false);
  };

  const loadFhir = async () => {
    const f = await api.fhir(patientId);
    setFhirData(f);
  };

  const sendAgentMessage = async () => {
    if (!agentMsg.trim()) return;
    const msg = agentMsg;
    setAgentMsg("");
    setAgentChat((c) => [...c, { role: "user", content: msg }]);
    setAgentLoading(true);
    try {
      const res = await api.agentChat(msg, patientId);
      setAgentChat((c) => [...c, { role: "assistant", content: res.response }]);
    } catch { setAgentChat((c) => [...c, { role: "assistant", content: "Error connecting to agent." }]); }
    setAgentLoading(false);
  };

  if (loading || !data) return <Shell><div className="flex items-center justify-center h-96 text-[#94a3b8]">Loading...</div></Shell>;

  const p = data.patient;
  const weights = data.observations.filter((o) => o.type === "weight").sort((a, b) => a.effective_date.localeCompare(b.effective_date));
  const heights = data.observations.filter((o) => o.type === "height");
  const activeAlerts = data.alerts.filter((a) => !a.resolved);
  const dqClass = p.data_quality_score >= 80 ? "good" : p.data_quality_score >= 60 ? "moderate" : p.data_quality_score >= 40 ? "high" : "critical";

  return (
    <Shell>
      {/* Patient Header */}
      <div className="glass-card mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold">{p.name}</h1>
              <span className={`badge badge-${p.risk_level === "moderate" ? "warning" : p.risk_level}`}>{p.risk_level}</span>
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-[#94a3b8]">
              <span>📋 {p.medical_record_number}</span>
              <span>{p.gender === "male" ? "♂ Male" : "♀ Female"}</span>
              <span>🎂 {p.age_months < 12 ? `${p.age_months.toFixed(0)} months` : `${p.age_years.toFixed(1)} years`}</span>
              <span>🏥 {p.ward} · {p.room}</span>
              <span>📅 Admitted {p.admission_date}</span>
            </div>
            <div className="text-sm text-[#64748b] mt-1">Dx: {p.diagnosis}</div>
          </div>
          <div className="flex items-center gap-4">
            <div className={`dq-score ${dqClass}`} style={{ width: 56, height: 56, fontSize: "1rem" }}>{p.data_quality_score}</div>
            <button onClick={runValidation} className="btn-primary" disabled={validating}>
              {validating ? "⏳..." : "🔍 Validate"}
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-[#334155] pb-1">
        {(["growth", "alerts", "notes", "fhir", "agent"] as const).map((t) => (
          <button key={t} onClick={() => { setTab(t); if (t === "fhir" && !fhirData) loadFhir(); }}
            className={`px-4 py-2 text-sm rounded-t-lg transition ${tab === t ? "bg-[#334155] text-[#f8fafc] font-semibold" : "text-[#94a3b8] hover:text-[#f8fafc]"}`}
          >
            {t === "growth" && "📈 Growth"}{t === "alerts" && `⚠️ Alerts (${activeAlerts.length})`}{t === "notes" && "📝 Notes"}{t === "fhir" && "🔗 FHIR"}{t === "agent" && "🤖 Agent"}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === "growth" && (
        <div className="glass-card fade-in">
          <h2 className="text-lg font-semibold mb-4">Weight Trajectory</h2>
          {weights.length === 0 ? <p className="text-[#64748b]">No weight measurements.</p> : (
            <div className="overflow-x-auto">
              <div className="flex items-end gap-1 h-48 px-2">
                {weights.map((w, i) => {
                  const maxW = Math.max(...weights.map((x) => x.value));
                  const minW = Math.min(...weights.map((x) => x.value));
                  const range = maxW - minW || 1;
                  const barH = ((w.value - minW) / range) * 140 + 20;
                  const isWarning = w.data_quality_score < 80;
                  return (
                    <div key={i} className="flex flex-col items-center flex-1 min-w-[24px] group relative">
                      <div className="text-[10px] text-[#94a3b8] mb-1 opacity-0 group-hover:opacity-100 transition">
                        {w.value}kg{w.zscore ? ` (z=${w.zscore > 0 ? "+" : ""}${w.zscore})` : ""}
                      </div>
                      <div
                        className={`w-full rounded-t transition-all ${isWarning ? "bg-gradient-to-t from-[#ef4444] to-[#f97316]" : "bg-gradient-to-t from-[#0284c7] to-[#0ea5e9]"}`}
                        style={{ height: barH }} title={`${w.value} ${w.unit} – ${w.effective_date.split("T")[0]}`}
                      />
                      <div className="text-[8px] text-[#64748b] mt-1 rotate-[-45deg] origin-top-left whitespace-nowrap">
                        {w.effective_date.split("T")[0].slice(5)}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-6 grid grid-cols-3 gap-4 text-sm">
                <div className="text-center"><div className="text-[#94a3b8] text-xs">Admission</div><div className="font-semibold">{weights[0]?.value} kg</div></div>
                <div className="text-center"><div className="text-[#94a3b8] text-xs">Latest</div><div className="font-semibold">{weights[weights.length - 1]?.value} kg</div></div>
                <div className="text-center"><div className="text-[#94a3b8] text-xs">Change</div><div className={`font-semibold ${(weights[weights.length - 1]?.value - weights[0]?.value) > 0 ? "text-[#22c55e]" : "text-[#ef4444]"}`}>{((weights[weights.length - 1]?.value - weights[0]?.value)).toFixed(2)} kg</div></div>
              </div>
            </div>
          )}
          {heights.length > 0 && (
            <div className="mt-6 pt-4 border-t border-[#334155]">
              <h3 className="text-sm font-semibold text-[#94a3b8] mb-2">Height Measurements</h3>
              <div className="flex gap-4 flex-wrap">
                {heights.map((h, i) => (
                  <div key={i} className="text-sm px-3 py-1.5 bg-[#334155] rounded-lg">
                    {h.value} {h.unit} <span className="text-[#64748b]">· {h.effective_date.split("T")[0]}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "alerts" && (
        <div className="space-y-3 fade-in">
          {activeAlerts.length === 0 && <div className="glass-card text-center text-[#64748b] py-8">✅ No active alerts. Run validation to check.</div>}
          {activeAlerts.map((a) => (
            <div key={a.id} className="glass-card">
              <div className="flex items-start gap-3">
                <span className="text-xl mt-0.5">{severityIcon[a.severity]}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`badge badge-${a.severity}`}>{a.severity}</span>
                    <span className="text-xs text-[#64748b] font-mono">{a.alert_type}</span>
                    <span className="text-xs text-[#475569]">· {a.tier}</span>
                  </div>
                  <p className="text-sm leading-relaxed">{a.message}</p>
                  {a.created_at && <div className="text-xs text-[#475569] mt-2">{new Date(a.created_at).toLocaleString()}</div>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "notes" && (
        <div className="space-y-3 fade-in">
          {data.notes.map((n) => (
            <div key={n.id} className="glass-card">
              <div className="flex items-center gap-2 mb-2">
                <span>{noteTypeIcon[n.note_type] || "📄"}</span>
                <span className="text-sm font-semibold capitalize">{n.note_type}</span>
                <span className="text-xs text-[#64748b]">· {n.author} · {n.effective_date.split("T")[0]}</span>
              </div>
              <p className="text-sm text-[#cbd5e1] leading-relaxed whitespace-pre-wrap">{n.content}</p>
              {n.extracted_signals && Object.keys(n.extracted_signals).length > 0 && (
                <div className="mt-3 pt-2 border-t border-[#334155]">
                  <div className="text-xs text-[#94a3b8] mb-1">🧠 NLP Signals Detected:</div>
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(n.extracted_signals).map(([cat, kws]) => (
                      <span key={cat} className="px-2 py-0.5 text-xs rounded bg-[#0ea5e9]/10 text-[#7dd3fc] border border-[#0ea5e9]/20">
                        {cat}: {(kws as string[]).join(", ")}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === "fhir" && (
        <div className="glass-card fade-in">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">FHIR R5 Bundle</h2>
            <a href={`/hackathon/api/fhir/${patientId}/download`} className="btn-primary text-sm">⬇️ Download JSON</a>
          </div>
          {fhirData ? (
            <pre className="bg-[#0f172a] rounded-lg p-4 text-xs text-[#06d6a0] overflow-auto max-h-[500px] font-mono">{JSON.stringify(fhirData, null, 2)}</pre>
          ) : <p className="text-[#64748b]">Loading FHIR bundle...</p>}
        </div>
      )}

      {tab === "agent" && (
        <div className="glass-card fade-in flex flex-col h-[500px]">
          <h2 className="text-lg font-semibold mb-3">🤖 CareAI Agent – {p.name}</h2>
          <div className="flex-1 overflow-y-auto space-y-3 mb-3">
            {agentChat.length === 0 && (
              <div className="text-sm text-[#64748b] text-center py-8">
                Ask about this patient&#39;s data quality, growth, or alerts.
                <div className="flex flex-wrap gap-2 justify-center mt-4">
                  {["Validate this patient", "Explain the alerts", "Summarize growth trend"].map((s) => (
                    <button key={s} onClick={() => { setAgentMsg(s); }} className="px-3 py-1 text-xs rounded-full border border-[#475569] hover:border-[#0ea5e9] transition">{s}</button>
                  ))}
                </div>
              </div>
            )}
            {agentChat.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${m.role === "user" ? "bg-[#0ea5e9] text-white rounded-br-sm" : "bg-[#334155] text-[#f8fafc] rounded-bl-sm"}`}>
                  {m.content}
                </div>
              </div>
            ))}
            {agentLoading && <div className="flex justify-start"><div className="bg-[#334155] px-4 py-2.5 rounded-2xl rounded-bl-sm text-sm text-[#94a3b8]">Thinking...</div></div>}
          </div>
          <div className="flex gap-2">
            <input
              value={agentMsg} onChange={(e) => setAgentMsg(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendAgentMessage()}
              placeholder="Ask CareAI Agent..." className="flex-1 px-4 py-2 rounded-lg bg-[#1e293b] border border-[#475569] text-sm focus:outline-none focus:border-[#0ea5e9]"
            />
            <button onClick={sendAgentMessage} className="btn-primary px-4" disabled={agentLoading}>Send</button>
          </div>
        </div>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <nav className="sticky top-0 z-50 border-b border-[#334155] bg-[#0f172a]/90 backdrop-blur-lg">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/hackathon" className="text-xl font-bold bg-gradient-to-r from-[#0ea5e9] to-[#06d6a0] bg-clip-text text-transparent">CareAI</Link>
          <div className="flex gap-6 text-sm">
            <Link href="/hackathon/dashboard" className="text-[#94a3b8] hover:text-[#0ea5e9] transition">Dashboard</Link>
            <Link href="/hackathon/patients" className="text-[#f8fafc] hover:text-[#0ea5e9] transition">Patients</Link>
            <Link href="/hackathon/agent" className="text-[#94a3b8] hover:text-[#0ea5e9] transition">AI Agent</Link>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
