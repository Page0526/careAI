"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

interface Patient {
  id: number; medical_record_number: string; name: string; age_months: number;
  gender: string; ward: string; diagnosis: string; risk_level: string;
  data_quality_score: number; alert_count: number; admission_date: string;
}

const riskIcon: Record<string, string> = { critical: "🔴", high: "🟠", moderate: "🟡", low: "🟢", unknown: "⚪" };

export default function PatientsPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (riskFilter) params.set("risk", riskFilter);
    api.patients(params.toString()).then((d) => { setPatients(d.patients); setLoading(false); });
  }, [search, riskFilter]);

  const dqClass = (s: number) => s >= 80 ? "good" : s >= 60 ? "moderate" : s >= 40 ? "high" : "critical";
  const formatAge = (m: number) => m < 12 ? `${m.toFixed(0)}m` : `${(m / 12).toFixed(1)}y`;

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

      <main className="max-w-7xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold mb-1">Patient Registry</h1>
        <p className="text-sm text-[#94a3b8] mb-6">Click a patient to view details, growth charts, and alerts</p>

        {/* Filters */}
        <div className="flex gap-4 mb-6 flex-wrap">
          <input
            type="text" placeholder="Search by name or MRN..." value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-4 py-2 rounded-lg bg-[#1e293b] border border-[#475569] text-sm focus:outline-none focus:border-[#0ea5e9] w-64"
          />
          <select
            value={riskFilter} onChange={(e) => setRiskFilter(e.target.value)}
            className="px-4 py-2 rounded-lg bg-[#1e293b] border border-[#475569] text-sm focus:outline-none focus:border-[#0ea5e9]"
          >
            <option value="">All Risk Levels</option>
            <option value="critical">🔴 Critical</option>
            <option value="high">🟠 High</option>
            <option value="moderate">🟡 Moderate</option>
            <option value="low">🟢 Low</option>
          </select>
        </div>

        {/* Table */}
        <div className="glass-card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#334155] text-[#94a3b8] text-xs uppercase tracking-wider">
                <th className="px-4 py-3 text-left">Patient</th>
                <th className="px-4 py-3 text-left">MRN</th>
                <th className="px-4 py-3 text-center">Age</th>
                <th className="px-4 py-3 text-left">Ward</th>
                <th className="px-4 py-3 text-center">Risk</th>
                <th className="px-4 py-3 text-center">DQ Score</th>
                <th className="px-4 py-3 text-center">Alerts</th>
              </tr>
            </thead>
            <tbody>
              {patients.map((p, i) => (
                <tr key={p.id} className="border-b border-[#1e293b] hover:bg-[#334155]/30 transition cursor-pointer fade-in" style={{ animationDelay: `${i * 30}ms` }}>
                  <td className="px-4 py-3">
                    <Link href={`/hackathon/patients/${p.id}`} className="hover:text-[#0ea5e9] transition">
                      <div className="font-medium">{p.name}</div>
                      <div className="text-xs text-[#64748b]">{p.gender === "male" ? "♂" : "♀"} · {p.diagnosis?.slice(0, 30)}</div>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-[#94a3b8] font-mono text-xs">{p.medical_record_number}</td>
                  <td className="px-4 py-3 text-center">{formatAge(p.age_months)}</td>
                  <td className="px-4 py-3 text-[#94a3b8]">{p.ward}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`badge badge-${p.risk_level === "moderate" ? "warning" : p.risk_level}`}>
                      {riskIcon[p.risk_level]} {p.risk_level}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`dq-score ${dqClass(p.data_quality_score)}`}>{p.data_quality_score}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {p.alert_count > 0 ? (
                      <span className="badge badge-critical animate-pulse-alert">{p.alert_count}</span>
                    ) : <span className="text-[#64748b]">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {patients.length === 0 && !loading && (
            <div className="text-center py-12 text-[#64748b]">No patients found.</div>
          )}
        </div>
      </main>
    </div>
  );
}
