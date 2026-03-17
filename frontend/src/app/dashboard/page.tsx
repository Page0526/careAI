"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

interface DashboardData {
  total_patients: number;
  active_alerts: number;
  avg_data_quality_score: number;
  severity_distribution: Record<string, number>;
  risk_distribution: Record<string, number>;
  ward_overview: { ward: string; patients: number; avg_dq_score: number }[];
  recent_alerts: { id: number; patient_id: number; severity: string; alert_type: string; message: string; tier: string }[];
}

const severityIcon: Record<string, string> = { critical: "🔴", high: "🟠", warning: "🟡", info: "🔵" };
const riskColor: Record<string, string> = { critical: "badge-critical", high: "badge-high", moderate: "badge-warning", low: "badge-low" };

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(false);

  const load = async () => {
    try { const d = await api.dashboard(); setData(d); } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const runBatchValidation = async () => {
    setValidating(true);
    try { await api.validateBatch(); await load(); } catch (e) { console.error(e); }
    setValidating(false);
  };

  const dqClass = (s: number) => s >= 80 ? "good" : s >= 60 ? "moderate" : s >= 40 ? "high" : "critical";

  if (loading) return <Layout><div className="flex items-center justify-center h-96"><div className="text-[#94a3b8] text-lg">Loading dashboard...</div></div></Layout>;

  return (
    <Layout>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[#f8fafc]">Dashboard</h1>
          <p className="text-sm text-[#94a3b8]">Pediatric EHR Data Quality Overview</p>
        </div>
        <button onClick={runBatchValidation} className="btn-primary" disabled={validating}>
          {validating ? "⏳ Validating..." : "🔄 Validate All Patients"}
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon="👶" label="Total Patients" value={data?.total_patients ?? 0} color="#0ea5e9" />
        <StatCard icon="⚠️" label="Active Alerts" value={data?.active_alerts ?? 0} color={data?.active_alerts ? "#ef4444" : "#22c55e"} />
        <StatCard icon="📊" label="Avg DQ Score" value={`${data?.avg_data_quality_score ?? 100}/100`} color={dqClass(data?.avg_data_quality_score ?? 100) === "good" ? "#22c55e" : "#eab308"} />
        <StatCard icon="🔗" label="FHIR Ready" value="R5" color="#06d6a0" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Alert Distribution */}
        <div className="glass-card">
          <h2 className="text-lg font-semibold mb-4">Alert Distribution</h2>
          {data?.severity_distribution && Object.entries(data.severity_distribution).map(([sev, count]) => (
            <div key={sev} className="flex items-center justify-between py-2 border-b border-[#334155] last:border-0">
              <span className="flex items-center gap-2">
                <span>{severityIcon[sev]}</span>
                <span className="capitalize text-sm">{sev}</span>
              </span>
              <span className={`badge badge-${sev}`}>{count}</span>
            </div>
          ))}
        </div>

        {/* Ward Overview */}
        <div className="glass-card">
          <h2 className="text-lg font-semibold mb-4">Ward Overview</h2>
          <div className="space-y-3">
            {data?.ward_overview?.map((w) => (
              <div key={w.ward} className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">{w.ward}</div>
                  <div className="text-xs text-[#94a3b8]">{w.patients} patients</div>
                </div>
                <div className={`dq-score ${dqClass(w.avg_dq_score)}`}>{w.avg_dq_score}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Alerts */}
        <div className="glass-card">
          <h2 className="text-lg font-semibold mb-4">Recent Alerts</h2>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {data?.recent_alerts?.length === 0 && <p className="text-sm text-[#64748b]">No active alerts. Run validation first.</p>}
            {data?.recent_alerts?.map((a) => (
              <Link key={a.id} href={`/hackathon/patients/${a.patient_id}`} className="block p-2 rounded-lg hover:bg-[#334155]/50 transition">
                <div className="flex items-start gap-2">
                  <span className="text-sm mt-0.5">{severityIcon[a.severity]}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-[#94a3b8]">{a.alert_type} · {a.tier}</div>
                    <div className="text-sm truncate">{a.message}</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}

function StatCard({ icon, label, value, color }: { icon: string; label: string; value: string | number; color: string }) {
  return (
    <div className="glass-card flex items-center gap-4">
      <div className="text-3xl">{icon}</div>
      <div>
        <div className="text-xs text-[#94a3b8] uppercase tracking-wider">{label}</div>
        <div className="text-2xl font-bold" style={{ color }}>{value}</div>
      </div>
    </div>
  );
}

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b border-[#334155] bg-[#0f172a]/90 backdrop-blur-lg">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/hackathon" className="text-xl font-bold bg-gradient-to-r from-[#0ea5e9] to-[#06d6a0] bg-clip-text text-transparent">
            CareAI
          </Link>
          <div className="flex gap-6 text-sm">
            <Link href="/hackathon/dashboard" className="text-[#f8fafc] hover:text-[#0ea5e9] transition">Dashboard</Link>
            <Link href="/hackathon/patients" className="text-[#94a3b8] hover:text-[#0ea5e9] transition">Patients</Link>
            <Link href="/hackathon/agent" className="text-[#94a3b8] hover:text-[#0ea5e9] transition">AI Agent</Link>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
