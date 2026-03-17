"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function Home() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#0f172a]" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] rounded-full bg-[#0ea5e9]/5 blur-[120px]" />
      <div className="absolute bottom-0 right-0 w-[600px] h-[600px] rounded-full bg-[#06d6a0]/5 blur-[100px]" />

      {/* Content */}
      <div className={`relative z-10 flex flex-col items-center justify-center min-h-screen px-6 text-center transition-opacity duration-1000 ${mounted ? 'opacity-100' : 'opacity-0'}`}>
        {/* Badge */}
        <div className="mb-6 px-4 py-1.5 rounded-full border border-[#475569] bg-[#1e293b]/80 backdrop-blur text-sm text-[#94a3b8]">
          🏥 HSIL Hackathon 2026 – Harvard T.H. Chan School of Public Health
        </div>

        {/* Logo & Title */}
        <h1 className="text-6xl md:text-7xl font-bold mb-4 tracking-tight">
          <span className="bg-gradient-to-r from-[#0ea5e9] via-[#7dd3fc] to-[#06d6a0] bg-clip-text text-transparent">
            CareAI
          </span>
        </h1>

        <p className="text-xl md:text-2xl text-[#94a3b8] max-w-2xl mb-2 leading-relaxed">
          AI-powered EHR Data Validation for
          <span className="text-[#f8fafc] font-semibold"> Pediatric Inpatient Nutrition</span>
        </p>

        <p className="text-sm text-[#64748b] max-w-lg mb-10">
          Real-time data quality assurance using NLP context matching, rule-based validation,
          and HL7 FHIR standardization – purpose-built for pediatric care.
        </p>

        {/* CTA */}
        <div className="flex gap-4 flex-wrap justify-center">
          <Link href="/hackathon/dashboard" className="btn-primary text-lg px-8 py-3 rounded-lg">
            🚀 Open Dashboard
          </Link>
          <Link
            href="/hackathon/agent"
            className="px-8 py-3 rounded-lg border border-[#475569] text-[#f8fafc] hover:border-[#0ea5e9] hover:bg-[#0ea5e9]/5 transition-all text-lg font-semibold"
          >
            🤖 AI Agent
          </Link>
        </div>

        {/* Feature Cards */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl w-full">
          {[
            { icon: "🔍", title: "Tier 1: Rule Engine", desc: "10 validation rules detect unit confusion, decimal errors, implausible trajectories, and more." },
            { icon: "🧠", title: "Tier 2: NLP Context", desc: "Cross-references clinical notes with structured data to find logical contradictions." },
            { icon: "🔗", title: "Tier 3: FHIR Export", desc: "Auto-generates validated Observation, NutritionOrder & NutritionIntake FHIR resources." },
          ].map((f, i) => (
            <div key={i} className="glass-card text-left fade-in" style={{ animationDelay: `${i * 0.15}s` }}>
              <div className="text-3xl mb-3">{f.icon}</div>
              <h3 className="text-lg font-semibold text-[#f8fafc] mb-1">{f.title}</h3>
              <p className="text-sm text-[#94a3b8] leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-16 text-xs text-[#475569]">
          Built by Team CareAI – Nutrition × AI × Data Quality
        </div>
      </div>
    </div>
  );
}
