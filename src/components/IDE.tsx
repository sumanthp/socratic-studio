"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from "react-resizable-panels";
import Editor from "./Editor";
import Terminal from "./Terminal";
import Chat from "./Chat";
import CurriculumPanel from "./CurriculumPanel";
import DisplayNameModal from "./DisplayNameModal";
import SnapshotPanel from "./SnapshotPanel";
import { Code2, Globe, Cpu, BookOpen, MessageSquare, Share2, Download, User, Package, FlaskConical, X, Plus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { FileEntry } from "@/types";
import { useSession } from "@/hooks/useSession";
import type { PersistedMessage } from "./Chat";

const MODULE_IDS = [
  "m1_api_basics",
  "m2_prompt_engineering",
  "m3_rag",
  "m4_agents",
  "m5_local_models",
];

const DEFAULT_CODE = `import os
from openai import OpenAI

# Initialize the OpenAI client
client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

def generate_greeting(name):
    """
    Generates a personalized greeting using the OpenAI API.
    """
    # TODO: Implement the API call here
    pass

# Test your function
if __name__ == "__main__":
    print(generate_greeting("Alice"))
`;

export default function IDE() {
  // ---- Session persistence -----------------------------------------------
  const {
    sessionId,
    displayName,
    isLoaded,
    saveFiles,
    saveMeta,
    saveMessages,
    setDisplayName,
    initialFiles,
    initialMessages,
    initialMeta,
  } = useSession();

  // ---- File state --------------------------------------------------------
  const [files, setFiles] = useState<FileEntry[]>([
    { name: "main.py", content: DEFAULT_CODE },
  ]);
  const [activeFileName, setActiveFileName] = useState("main.py");

  // ---- Execution trigger -------------------------------------------------
  const [executionCount, setExecutionCount] = useState(0);

  // ---- Curriculum state --------------------------------------------------
  const [milestone, setMilestone] = useState("API Basics & Prompting");
  const [activeModuleIndex, setActiveModuleIndex] = useState(0);
  const [leftTab, setLeftTab] = useState<"council" | "curriculum">("council");

  // ---- Provider ----------------------------------------------------------
  const [provider, setProvider] = useState("openai");

  // ---- Display name modal ------------------------------------------------
  const [showNameModal, setShowNameModal] = useState(false);

  // ---- Phase 4: packages, test mode, snapshots ---------------------------
  const [packages, setPackages] = useState<string[]>([]);
  const [pkgInput, setPkgInput] = useState("");
  const [showPkgPopover, setShowPkgPopover] = useState(false);
  const [execMode, setExecMode] = useState<"run" | "test">("run");

  // ---- Monotonic message sequence counter --------------------------------
  const persistedSeqRef = useRef(0);

  // ---- Hydrate from session on load -------------------------------------
  useEffect(() => {
    if (!isLoaded) return;
    if (initialFiles && initialFiles.length > 0) {
      setFiles(initialFiles);
    }
    if (initialMessages) {
      persistedSeqRef.current = initialMessages.length;
    }
    if (initialMeta) {
      if (initialMeta.provider) setProvider(initialMeta.provider);
      if (typeof initialMeta.active_module_index === "number") setActiveModuleIndex(initialMeta.active_module_index);
      if (initialMeta.milestone) setMilestone(initialMeta.milestone);
      if (initialMeta.active_file_name) setActiveFileName(initialMeta.active_file_name);
    }
    if (!displayName) setShowNameModal(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded]);

  // ---- File callbacks ----------------------------------------------------
  const addFile = useCallback((name: string) => {
    setFiles(prev => {
      if (prev.find(f => f.name === name)) return prev;
      return [...prev, { name, content: "" }];
    });
    setActiveFileName(name);
  }, []);

  const removeFile = useCallback((name: string) => {
    setFiles(prev => {
      if (prev.length <= 1) return prev;
      const next = prev.filter(f => f.name !== name);
      if (name === activeFileName) setActiveFileName(next[0].name);
      return next;
    });
  }, [activeFileName]);

  const updateFileContent = useCallback((name: string, content: string) => {
    setFiles(prev => {
      const updated = prev.map(f => f.name === name ? { ...f, content } : f);
      saveFiles(updated, activeFileName);
      return updated;
    });
  }, [activeFileName, saveFiles]);

  // ---- Apply code from chat agent ----------------------------------------
  const handleApplyCode = useCallback((code: string) => {
    setFiles(prev => {
      const updated = prev.map(f => f.name === activeFileName ? { ...f, content: code } : f);
      saveFiles(updated, activeFileName);
      return updated;
    });
  }, [activeFileName, saveFiles]);

  // ---- Curriculum callbacks ----------------------------------------------
  const handleSelectModule = useCallback((index: number) => {
    setActiveModuleIndex(index);
    saveMeta({ active_module_index: index });
  }, [saveMeta]);

  const handleLoadStarterCode = useCallback((code: string) => {
    setFiles(prev => {
      const updated = prev.map(f => f.name === "main.py" ? { ...f, content: code } : f);
      saveFiles(updated, "main.py");
      return updated;
    });
    setActiveFileName("main.py");
  }, [saveFiles]);

  // ---- Provider change ---------------------------------------------------
  const handleProviderChange = useCallback((p: string) => {
    setProvider(p);
    saveMeta({ provider: p });
  }, [saveMeta]);

  // ---- Milestone update --------------------------------------------------
  const handleMilestoneUpdate = useCallback((m: string) => {
    setMilestone(m);
    saveMeta({ milestone: m });
  }, [saveMeta]);

  // ---- Active file change (from FileTree) --------------------------------
  const handleActiveChange = useCallback((name: string) => {
    setActiveFileName(name);
    saveMeta({ active_file_name: name });
  }, [saveMeta]);

  // ---- Session messages --------------------------------------------------
  const handleNewMessages = useCallback((msgs: PersistedMessage[]) => {
    if (!sessionId) return;
    const withSeq = msgs.map((m, i) => ({ ...m, seq: persistedSeqRef.current + i }));
    persistedSeqRef.current += msgs.length;
    saveMessages(withSeq);
  }, [sessionId, saveMessages]);

  // ---- Restore from snapshot ---------------------------------------------
  const handleRestoreSnapshot = useCallback((restoredFiles: FileEntry[]) => {
    setFiles(restoredFiles);
    const firstName = restoredFiles[0]?.name ?? "main.py";
    setActiveFileName(firstName);
    saveFiles(restoredFiles, firstName);
  }, [saveFiles]);

  // ---- Package tag helpers -----------------------------------------------
  const addPackage = useCallback(() => {
    const name = pkgInput.trim();
    if (name && !packages.includes(name)) {
      setPackages(prev => [...prev, name]);
    }
    setPkgInput("");
  }, [pkgInput, packages]);

  const removePackage = useCallback((pkg: string) => {
    setPackages(prev => prev.filter(p => p !== pkg));
  }, []);

  // ---- Display name submit -----------------------------------------------
  const handleNameSubmit = useCallback(async (name: string) => {
    setShowNameModal(false);
    if (name && name !== "Anonymous") {
      await setDisplayName(name);
    }
  }, [setDisplayName]);

  // ---- Export session as JSON -------------------------------------------
  const handleExport = useCallback(() => {
    const payload = {
      sessionId,
      displayName,
      provider,
      milestone,
      activeModuleIndex,
      files,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `oasis-session-${sessionId?.slice(0, 8) ?? "export"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [sessionId, displayName, provider, milestone, activeModuleIndex, files]);

  // ---- Share link --------------------------------------------------------
  const handleShare = useCallback(() => {
    if (!sessionId) return;
    const url = `${window.location.origin}/share/${sessionId}`;
    navigator.clipboard.writeText(url).catch(console.error);
    alert(`Share link copied!\n\n${url}`);
  }, [sessionId]);

  // Code context passed to the chat (all files formatted)
  const codeContext = files
    .map(f => `# === ${f.name} ===\n${f.content}`)
    .join("\n\n");

  const currentModuleId = MODULE_IDS[activeModuleIndex] ?? MODULE_IDS[0];

  return (
    <div className="fixed inset-0 flex flex-col p-6">
      {/* Background layers */}
      <div className="aether-bg" />
      <div className="blueprint-grid" />
      <div className="scan-line" />

      {/* Display name modal */}
      <DisplayNameModal open={showNameModal} onSubmit={handleNameSubmit} />

      {/* Header */}
      <header className="h-16 flex-shrink-0 flex items-center justify-between px-8 mb-6 bg-white/[0.03] border border-white/10 backdrop-blur-3xl rounded-2xl relative z-50 shadow-2xl shadow-indigo-500/5">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 border border-indigo-400/20">
              <Code2 size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-xs font-black tracking-[0.3em] uppercase text-white/95">Oasis</h1>
              <p className="text-[8px] font-bold text-white/20 uppercase tracking-[0.4em] -mt-0.5">Laboratory.Alpha</p>
            </div>
          </div>

          <div className="h-6 w-px bg-white/10" />

          <AnimatePresence mode="wait">
            <motion.div
              key={milestone}
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 5 }}
              className="flex items-center gap-3 px-4 py-2 bg-indigo-500/5 border border-indigo-500/10 rounded-xl"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)] animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-100/70">{milestone}</span>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex items-center gap-3">
          {/* Display name */}
          {displayName && (
            <button
              onClick={() => setShowNameModal(true)}
              className="flex items-center gap-2 text-white/30 hover:text-white/60 transition-colors"
              title="Change display name"
            >
              <User size={11} />
              <span className="text-[9px] font-bold uppercase tracking-widest">{displayName}</span>
            </button>
          )}

          {/* Snapshots */}
          <SnapshotPanel
            sessionId={sessionId}
            currentFiles={files}
            onRestore={handleRestoreSnapshot}
          />

          {/* Export & Share */}
          <div className="flex items-center gap-1">
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 px-3 py-1.5 text-white/25 hover:text-white/60 text-[9px] font-black uppercase tracking-widest transition-colors border border-white/5 hover:border-white/10 rounded-lg"
              title="Export session as JSON"
            >
              <Download size={10} />
              Export
            </button>
            <button
              onClick={handleShare}
              className="flex items-center gap-1.5 px-3 py-1.5 text-indigo-400/60 hover:text-indigo-300 text-[9px] font-black uppercase tracking-widest transition-colors border border-indigo-500/10 hover:border-indigo-500/30 rounded-lg"
              title="Copy share link"
            >
              <Share2 size={10} />
              Share
            </button>
          </div>

          <div className="h-6 w-px bg-white/10" />

          {/* Provider toggle */}
          <div className="flex items-center bg-black/60 p-1 rounded-xl border border-white/5 shadow-2xl">
            <button
              onClick={() => handleProviderChange("openai")}
              className={`flex items-center gap-2 px-5 py-2 rounded-lg text-[9px] font-black uppercase tracking-[0.15em] transition-all ${provider === "openai" ? "bg-white text-black shadow-xl scale-[1.02]" : "text-white/20 hover:text-white/40"}`}
            >
              <Globe size={11} />
              OpenAI
            </button>
            <button
              onClick={() => handleProviderChange("ollama")}
              className={`flex items-center gap-2 px-5 py-2 rounded-lg text-[9px] font-black uppercase tracking-[0.15em] transition-all ${provider === "ollama" ? "bg-indigo-600 text-white shadow-xl shadow-indigo-500/40 scale-[1.02] border border-indigo-400/30" : "text-white/20 hover:text-white/40"}`}
            >
              <Cpu size={11} />
              Ollama
            </button>
          </div>

          {/* Packages popover */}
          <div className="relative">
            <button
              onClick={() => setShowPkgPopover(p => !p)}
              title="Manage pip packages"
              className={`flex items-center gap-1.5 h-10 px-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border ${
                packages.length > 0
                  ? "bg-amber-500/10 border-amber-500/20 text-amber-400"
                  : "bg-white/5 border-white/10 text-white/30 hover:text-white/60"
              }`}
            >
              <Package size={11} />
              {packages.length > 0 && <span>{packages.length}</span>}
            </button>

            <AnimatePresence>
              {showPkgPopover && (
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.97 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-full right-0 mt-1 w-64 bg-[#0d0d10] border border-white/10 rounded-xl shadow-2xl shadow-black/60 z-50 p-3 flex flex-col gap-2"
                >
                  <div className="text-[9px] font-black uppercase tracking-widest text-white/30">Pip Packages</div>
                  <div className="flex gap-2">
                    <input
                      autoFocus
                      value={pkgInput}
                      onChange={e => setPkgInput(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") addPackage(); if (e.key === "Escape") setShowPkgPopover(false); }}
                      placeholder="e.g. requests"
                      className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-[11px] text-white placeholder-white/20 focus:outline-none focus:border-amber-500/40 font-mono"
                    />
                    <button onClick={addPackage} className="px-2 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 rounded-lg transition-all">
                      <Plus size={12} />
                    </button>
                  </div>
                  {packages.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {packages.map(pkg => (
                        <span key={pkg} className="flex items-center gap-1 px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded-full text-[10px] text-amber-300/80 font-mono">
                          {pkg}
                          <button onClick={() => removePackage(pkg)} className="text-amber-400/50 hover:text-rose-400 transition-colors">
                            <X size={9} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="text-[9px] text-white/20 italic">Packages are installed before each run.</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Run Tests button */}
          <button
            onClick={() => { setExecMode("test"); setExecutionCount(c => c + 1); }}
            className="flex items-center gap-2 px-5 h-10 rounded-xl bg-emerald-950 text-emerald-400 border border-emerald-500/20 font-black text-[10px] uppercase tracking-[0.15em] transition-all hover:bg-emerald-900 hover:scale-[1.03] active:scale-[0.95] shadow-lg"
          >
            <FlaskConical size={13} />
            Tests
          </button>

          <button
            onClick={() => { setExecMode("run"); setExecutionCount(c => c + 1); }}
            className="px-8 h-10 rounded-xl bg-white text-black font-black text-[10px] uppercase tracking-[0.25em] transition-all hover:bg-indigo-50 hover:scale-[1.05] active:scale-[0.95] shadow-2xl shadow-white/10 border border-white/20"
          >
            Run
          </button>
        </div>
      </header>

      {/* Main workspace */}
      <main className="flex-1 min-h-0 relative z-10">
        <PanelGroup direction="horizontal">

          {/* Left panel: Council + Curriculum tabs */}
          <Panel defaultSize={28} minSize={20} className="bg-white/[0.01] border border-white/5 rounded-3xl overflow-hidden backdrop-blur-sm relative shadow-2xl shadow-black/50 flex flex-col">
            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-indigo-500/30 to-transparent" />

            {/* Tab bar */}
            <div className="flex border-b border-white/5 shrink-0">
              <button
                onClick={() => setLeftTab("council")}
                className={`flex-1 flex items-center justify-center gap-2 py-3 text-[9px] font-black uppercase tracking-[0.2em] transition-colors ${
                  leftTab === "council"
                    ? "text-indigo-300 border-b-2 border-indigo-500 bg-white/[0.02]"
                    : "text-white/25 hover:text-white/50"
                }`}
              >
                <MessageSquare size={11} />
                Council
              </button>
              <button
                onClick={() => setLeftTab("curriculum")}
                className={`flex-1 flex items-center justify-center gap-2 py-3 text-[9px] font-black uppercase tracking-[0.2em] transition-colors ${
                  leftTab === "curriculum"
                    ? "text-indigo-300 border-b-2 border-indigo-500 bg-white/[0.02]"
                    : "text-white/25 hover:text-white/50"
                }`}
              >
                <BookOpen size={11} />
                Curriculum
              </button>
            </div>

            {/* Tab content */}
            <div className="flex-1 min-h-0">
              {leftTab === "council" ? (
                <Chat
                  codeContext={codeContext}
                  provider={provider}
                  currentModule={currentModuleId}
                  activeFileName={activeFileName}
                  onMilestoneUpdate={handleMilestoneUpdate}
                  onApplyCode={handleApplyCode}
                  initialMessages={initialMessages ?? undefined}
                  onNewMessages={handleNewMessages}
                />
              ) : (
                <CurriculumPanel
                  activeModuleIndex={activeModuleIndex}
                  onSelectModule={handleSelectModule}
                  onLoadStarterCode={handleLoadStarterCode}
                />
              )}
            </div>
          </Panel>

          <PanelResizeHandle className="w-4 group flex items-center justify-center transition-all">
            <div className="w-px h-12 bg-white/5 group-hover:bg-indigo-500/50 transition-colors shadow-[0_0_10px_rgba(99,102,241,0.5)]" />
          </PanelResizeHandle>

          {/* Right panel: Editor + Terminal */}
          <Panel defaultSize={72}>
            <PanelGroup direction="vertical">
              <Panel defaultSize={65} minSize={30} className="bg-white/[0.01] border border-white/5 rounded-3xl overflow-hidden backdrop-blur-sm flex flex-col relative shadow-2xl shadow-black/50">
                <Editor
                  files={files}
                  activeFileName={activeFileName}
                  onFileChange={updateFileContent}
                  onActiveChange={handleActiveChange}
                  onAddFile={addFile}
                  onRemoveFile={removeFile}
                />
              </Panel>

              <PanelResizeHandle className="h-4 group flex items-center justify-center transition-all">
                <div className="h-px w-12 bg-white/5 group-hover:bg-indigo-500/50 transition-colors shadow-[0_0_10px_rgba(99,102,241,0.5)]" />
              </PanelResizeHandle>

              <Panel defaultSize={35} minSize={15} className="bg-black/40 border border-white/5 rounded-3xl overflow-hidden backdrop-blur-sm relative shadow-2xl shadow-black/50">
                <Terminal
                  files={files}
                  executionCount={executionCount}
                  packages={packages.length > 0 ? packages : undefined}
                  mode={execMode}
                />
              </Panel>
            </PanelGroup>
          </Panel>

        </PanelGroup>
      </main>
    </div>
  );
}
