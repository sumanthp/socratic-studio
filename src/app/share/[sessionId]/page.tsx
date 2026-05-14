"use client";

import { useEffect, useState } from "react";
import { use } from "react";
import { Code2, FileCode2, MessageSquare, User, BookOpen, Lock } from "lucide-react";
import { motion } from "framer-motion";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface SharedFile {
  name: string;
  content: string;
}

interface SharedMessage {
  role: string;
  content: string;
  seq: number;
}

interface SharedSession {
  id: string;
  display_name: string | null;
  provider: string;
  milestone: string;
  active_module_index: number;
  files: SharedFile[];
  messages: SharedMessage[];
}

type Tab = "files" | "chat";

function CodeView({ content }: { content: string }) {
  return (
    <pre className="text-[12px] font-mono text-white/70 leading-relaxed overflow-x-auto p-6 bg-[#09090b]/50 rounded-2xl border border-white/5">
      <code>{content}</code>
    </pre>
  );
}

export default function SharePage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params);
  const [session, setSession] = useState<SharedSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("files");
  const [activeFile, setActiveFile] = useState<string>("");

  useEffect(() => {
    fetch(`${API_BASE}/api/sessions/${sessionId}`)
      .then((res) => {
        if (!res.ok) throw new Error("Session not found");
        return res.json();
      })
      .then((data: SharedSession) => {
        setSession(data);
        if (data.files.length > 0) setActiveFile(data.files[0].name);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [sessionId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#030304] flex items-center justify-center">
        <div className="text-white/30 text-sm font-mono uppercase tracking-widest animate-pulse">
          Loading session...
        </div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="min-h-screen bg-[#030304] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center">
          <Lock size={32} className="text-white/20" />
          <p className="text-white/40 text-sm font-mono">Session not found or unavailable.</p>
        </div>
      </div>
    );
  }

  const activeFileContent = session.files.find(f => f.name === activeFile)?.content ?? "";

  return (
    <div className="min-h-screen bg-[#030304] flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-5 border-b border-white/5">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 rounded-xl bg-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Code2 size={16} className="text-white" />
          </div>
          <div>
            <p className="text-xs font-black tracking-[0.3em] uppercase text-white/90">Oasis</p>
            <p className="text-[8px] font-bold text-white/20 uppercase tracking-[0.3em]">Shared Session</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {session.display_name && (
            <div className="flex items-center gap-2 text-white/30">
              <User size={11} />
              <span className="text-[10px] font-bold uppercase tracking-widest">{session.display_name}</span>
            </div>
          )}
          <div className="px-4 py-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-300/70">{session.milestone}</span>
          </div>
        </div>
      </header>

      {/* Read-only banner */}
      <div className="bg-amber-500/5 border-b border-amber-500/10 px-8 py-2 flex items-center gap-2">
        <Lock size={10} className="text-amber-500/60" />
        <span className="text-[10px] text-amber-500/60 font-bold uppercase tracking-widest">
          Read-only view — this session was shared by {session.display_name ?? "another user"}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col max-w-5xl w-full mx-auto px-8 py-8 gap-6">
        {/* Tabs */}
        <div className="flex gap-1 bg-black/40 p-1 rounded-xl border border-white/5 self-start">
          <button
            onClick={() => setActiveTab("files")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-[0.15em] transition-all ${
              activeTab === "files" ? "bg-white/10 text-white" : "text-white/25 hover:text-white/50"
            }`}
          >
            <FileCode2 size={11} />
            Files ({session.files.length})
          </button>
          <button
            onClick={() => setActiveTab("chat")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-[0.15em] transition-all ${
              activeTab === "chat" ? "bg-white/10 text-white" : "text-white/25 hover:text-white/50"
            }`}
          >
            <MessageSquare size={11} />
            Chat ({session.messages.length})
          </button>
        </div>

        {activeTab === "files" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col gap-4"
          >
            {/* File tabs */}
            {session.files.length > 1 && (
              <div className="flex gap-1 overflow-x-auto">
                {session.files.map(f => (
                  <button
                    key={f.name}
                    onClick={() => setActiveFile(f.name)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-mono shrink-0 transition-all ${
                      f.name === activeFile
                        ? "bg-white/10 text-white border border-white/10"
                        : "text-white/30 hover:text-white/60 border border-transparent"
                    }`}
                  >
                    <FileCode2 size={10} className="text-emerald-400/70" />
                    {f.name}
                  </button>
                ))}
              </div>
            )}
            {session.files.length === 0 ? (
              <div className="text-white/20 italic text-sm font-mono">No files in this session.</div>
            ) : (
              <CodeView content={activeFileContent} />
            )}
          </motion.div>
        )}

        {activeTab === "chat" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col gap-6"
          >
            {session.messages.length === 0 ? (
              <div className="text-white/20 italic text-sm font-mono">No messages in this session.</div>
            ) : (
              session.messages.map((msg) => {
                const isHuman = msg.role === "human";
                return (
                  <div key={msg.seq} className={`flex gap-4 ${isHuman ? "flex-row-reverse" : "flex-row"}`}>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border border-white/5 ${isHuman ? "bg-white" : "bg-indigo-500/10"}`}>
                      {isHuman ? (
                        <User size={14} className="text-black" />
                      ) : (
                        <BookOpen size={14} className="text-indigo-400" />
                      )}
                    </div>
                    <div className={`flex flex-col gap-1.5 max-w-[80%] ${isHuman ? "items-end" : "items-start"}`}>
                      <div className={`text-[9px] font-black uppercase tracking-[0.2em] ${isHuman ? "text-white/40" : "text-indigo-400"}`}>
                        {msg.role}
                      </div>
                      <div className={`text-[12px] leading-relaxed p-4 rounded-xl border whitespace-pre-wrap ${
                        isHuman
                          ? "text-white bg-white/5 border-white/10"
                          : "text-white/70 bg-indigo-500/10 border-indigo-500/20"
                      }`}>
                        {msg.content}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}
