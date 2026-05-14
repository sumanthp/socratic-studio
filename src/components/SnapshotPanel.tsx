"use client";

import { useState, useEffect, useCallback } from "react";
import { Camera, Clock, RotateCcw, Trash2, Plus, ChevronDown, ChevronUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { FileEntry } from "@/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface Snapshot {
  id: number;
  name: string;
  created_at: string;
  files: FileEntry[];
}

interface SnapshotPanelProps {
  sessionId: string | null;
  currentFiles: FileEntry[];
  onRestore: (files: FileEntry[]) => void;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function SnapshotPanel({ sessionId, currentFiles, onRestore }: SnapshotPanelProps) {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [showNameInput, setShowNameInput] = useState(false);
  const [restoredId, setRestoredId] = useState<number | null>(null);

  const fetchSnapshots = useCallback(() => {
    if (!sessionId) return;
    fetch(`${API_BASE}/api/sessions/${sessionId}/snapshots`)
      .then(r => r.json())
      .then(setSnapshots)
      .catch(() => {});
  }, [sessionId]);

  useEffect(() => {
    if (expanded) fetchSnapshots();
  }, [expanded, fetchSnapshots]);

  const handleSave = async () => {
    if (!sessionId) return;
    setSaving(true);
    const name = nameInput.trim() || `Snapshot ${new Date().toLocaleTimeString()}`;
    try {
      await fetch(`${API_BASE}/api/sessions/${sessionId}/snapshots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, files: currentFiles }),
      });
      setNameInput("");
      setShowNameInput(false);
      fetchSnapshots();
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!sessionId) return;
    await fetch(`${API_BASE}/api/sessions/${sessionId}/snapshots/${id}`, { method: "DELETE" });
    setSnapshots(prev => prev.filter(s => s.id !== id));
  };

  const handleRestore = (snap: Snapshot) => {
    onRestore(snap.files);
    setRestoredId(snap.id);
    setTimeout(() => setRestoredId(null), 2000);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setExpanded(p => !p)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-white/25 hover:text-white/60 text-[9px] font-black uppercase tracking-widest transition-colors border border-white/5 hover:border-white/10 rounded-lg"
        title="Code snapshots"
      >
        <Camera size={10} />
        Snapshots
        {snapshots.length > 0 && (
          <span className="ml-0.5 bg-indigo-500/30 text-indigo-300 rounded px-1 text-[8px]">{snapshots.length}</span>
        )}
        {expanded ? <ChevronUp size={9} /> : <ChevronDown size={9} />}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full right-0 mt-1 w-72 bg-[#0d0d10] border border-white/10 rounded-xl shadow-2xl shadow-black/60 z-50 overflow-hidden"
          >
            {/* Save area */}
            <div className="p-3 border-b border-white/5">
              {showNameInput ? (
                <div className="flex gap-2">
                  <input
                    autoFocus
                    value={nameInput}
                    onChange={e => setNameInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") setShowNameInput(false); }}
                    placeholder="Snapshot name..."
                    className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-[11px] text-white placeholder-white/20 focus:outline-none focus:border-indigo-500/40 font-mono"
                  />
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-[10px] font-black rounded-lg transition-all"
                  >
                    {saving ? "..." : "Save"}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowNameInput(true)}
                  className="w-full flex items-center justify-center gap-2 py-2 bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 rounded-lg text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-white/70 transition-all"
                >
                  <Plus size={10} />
                  Save current state
                </button>
              )}
            </div>

            {/* Snapshot list */}
            <div className="max-h-64 overflow-y-auto custom-scrollbar">
              {snapshots.length === 0 ? (
                <div className="p-4 text-center text-white/20 text-[10px] italic">No snapshots yet.</div>
              ) : (
                snapshots.slice().reverse().map(snap => (
                  <div
                    key={snap.id}
                    className="flex items-center gap-3 px-3 py-2.5 hover:bg-white/[0.03] group transition-colors border-b border-white/[0.03]"
                  >
                    <Camera size={11} className="text-indigo-400/50 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] text-white/70 truncate font-mono">{snap.name}</div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Clock size={8} className="text-white/20" />
                        <span className="text-[9px] text-white/20">{timeAgo(snap.created_at)}</span>
                        <span className="text-[9px] text-white/15">· {snap.files.length} file{snap.files.length !== 1 ? "s" : ""}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleRestore(snap)}
                        title="Restore snapshot"
                        className={`p-1 rounded transition-colors ${restoredId === snap.id ? "text-emerald-400" : "text-white/30 hover:text-indigo-400"}`}
                      >
                        <RotateCcw size={11} />
                      </button>
                      <button
                        onClick={() => handleDelete(snap.id)}
                        title="Delete snapshot"
                        className="p-1 rounded text-white/30 hover:text-rose-400 transition-colors"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
