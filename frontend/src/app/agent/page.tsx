"use client";
import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

export default function AgentPage() {
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const send = async () => {
    if (!input.trim() || loading) return;
    const msg = input;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: msg }]);
    setLoading(true);
    try {
      const res = await api.agentChat(msg);
      setMessages((m) => [...m, { role: "assistant", content: res.response }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "⚠️ Connection error. Please try again." }]);
    }
    setLoading(false);
  };

  const suggestions = [
    "What can you do?",
    "Validate all patients",
    "Show high-risk patients",
    "Explain FHIR resources",
    "What is a z-score?",
    "How does Tier 2 NLP work?",
  ];

  return (
    <div className="min-h-screen flex flex-col">
      {/* Nav */}
      <nav className="border-b border-[#334155] bg-[#0f172a]/90 backdrop-blur-lg">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/hackathon" className="text-xl font-bold bg-gradient-to-r from-[#0ea5e9] to-[#06d6a0] bg-clip-text text-transparent">CareAI</Link>
          <div className="flex gap-6 text-sm">
            <Link href="/hackathon/dashboard" className="text-[#94a3b8] hover:text-[#0ea5e9] transition">Dashboard</Link>
            <Link href="/hackathon/patients" className="text-[#94a3b8] hover:text-[#0ea5e9] transition">Patients</Link>
            <Link href="/hackathon/agent" className="text-[#f8fafc] hover:text-[#0ea5e9] transition">AI Agent</Link>
          </div>
        </div>
      </nav>

      {/* Chat Area */}
      <div className="flex-1 max-w-4xl mx-auto w-full px-4 py-6 flex flex-col">
        <div className="flex-1 overflow-y-auto space-y-4 mb-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center py-20">
              <div className="text-6xl mb-4">🤖</div>
              <h2 className="text-2xl font-bold mb-2">CareAI Agent</h2>
              <p className="text-[#94a3b8] mb-8 max-w-md">
                I&#39;m your clinical data quality assistant. Ask me about patient data, validation rules,
                growth standards, or FHIR resources.
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {suggestions.map((s) => (
                  <button key={s} onClick={() => setInput(s)}
                    className="px-4 py-2 text-sm rounded-full border border-[#475569] text-[#94a3b8] hover:border-[#0ea5e9] hover:text-[#f8fafc] transition"
                  >{s}</button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"} fade-in`}>
              <div className={`max-w-[80%] px-5 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                m.role === "user"
                  ? "bg-gradient-to-r from-[#0ea5e9] to-[#0284c7] text-white rounded-br-sm"
                  : "bg-[#1e293b] border border-[#334155] text-[#f8fafc] rounded-bl-sm"
              }`}>
                {m.content}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start fade-in">
              <div className="bg-[#1e293b] border border-[#334155] px-5 py-3 rounded-2xl rounded-bl-sm text-sm">
                <div className="flex gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-[#0ea5e9] animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-2 h-2 rounded-full bg-[#0ea5e9] animate-bounce" style={{ animationDelay: "200ms" }} />
                  <div className="w-2 h-2 rounded-full bg-[#0ea5e9] animate-bounce" style={{ animationDelay: "400ms" }} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="flex gap-3">
          <input
            value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Ask CareAI anything about data quality, growth standards, FHIR..."
            className="flex-1 px-5 py-3 rounded-xl bg-[#1e293b] border border-[#475569] text-sm focus:outline-none focus:border-[#0ea5e9] transition"
          />
          <button onClick={send} className="btn-primary px-6 text-sm" disabled={loading}>
            {loading ? "..." : "Send →"}
          </button>
        </div>
      </div>
    </div>
  );
}
