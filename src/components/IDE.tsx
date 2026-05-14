"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from "react-resizable-panels";
import { motion, AnimatePresence } from "framer-motion";
import Editor from "./Editor";
import Terminal from "./Terminal";
import Chat from "./Chat";
import CurriculumPanel from "./CurriculumPanel";
import DisplayNameModal from "./DisplayNameModal";
import SnapshotPanel from "./SnapshotPanel";
import {
  Code2, Globe, Cpu, Share2, Download, User,
  Package, FlaskConical, X, Plus, ChevronLeft, ChevronRight,
  PlayCircle,
} from "lucide-react";
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
  const {
    sessionId, displayName, isLoaded, saveFiles, saveMeta, saveMessages,
    setDisplayName, initialFiles, initialMessages, initialMeta,
  } = useSession();

  const [files, setFiles]                   = useState<FileEntry[]>([{ name: "main.py", content: DEFAULT_CODE }]);
  const [activeFileName, setActiveFileName] = useState("main.py");
  const [executionCount, setExecutionCount] = useState(0);
  const [milestone, setMilestone]           = useState("API Basics & Prompting");
  const [activeModuleIndex, setActiveModuleIndex] = useState(0);
  const [provider, setProvider]             = useState("openai");
  const [showNameModal, setShowNameModal]   = useState(false);
  const [showCodePanel, setShowCodePanel]   = useState(true);
  const [packages, setPackages]             = useState<string[]>([]);
  const [pkgInput, setPkgInput]             = useState("");
  const [showPkgPopover, setShowPkgPopover] = useState(false);
  const [execMode, setExecMode]             = useState<"run" | "test">("run");
  const persistedSeqRef = useRef(0);

  useEffect(() => {
    if (!isLoaded) return;
    if (initialFiles?.length)       setFiles(initialFiles);
    if (initialMessages)            persistedSeqRef.current = initialMessages.length;
    if (initialMeta) {
      if (initialMeta.provider)           setProvider(initialMeta.provider);
      if (typeof initialMeta.active_module_index === "number") setActiveModuleIndex(initialMeta.active_module_index);
      if (initialMeta.milestone)          setMilestone(initialMeta.milestone);
      if (initialMeta.active_file_name)   setActiveFileName(initialMeta.active_file_name);
    }
    if (!displayName) setShowNameModal(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded]);

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

  const handleApplyCode = useCallback((code: string) => {
    setFiles(prev => {
      const updated = prev.map(f => f.name === activeFileName ? { ...f, content: code } : f);
      saveFiles(updated, activeFileName);
      return updated;
    });
    setShowCodePanel(true);
  }, [activeFileName, saveFiles]);

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
    setShowCodePanel(true);
  }, [saveFiles]);

  const handleProviderChange = useCallback((p: string) => {
    setProvider(p);
    saveMeta({ provider: p });
  }, [saveMeta]);

  const handleMilestoneUpdate = useCallback((m: string) => {
    setMilestone(m);
    saveMeta({ milestone: m });
  }, [saveMeta]);

  const handleActiveChange = useCallback((name: string) => {
    setActiveFileName(name);
    saveMeta({ active_file_name: name });
  }, [saveMeta]);

  const handleNewMessages = useCallback((msgs: PersistedMessage[]) => {
    if (!sessionId) return;
    const withSeq = msgs.map((m, i) => ({ ...m, seq: persistedSeqRef.current + i }));
    persistedSeqRef.current += msgs.length;
    saveMessages(withSeq);
  }, [sessionId, saveMessages]);

  const handleRestoreSnapshot = useCallback((restoredFiles: FileEntry[]) => {
    setFiles(restoredFiles);
    const firstName = restoredFiles[0]?.name ?? "main.py";
    setActiveFileName(firstName);
    saveFiles(restoredFiles, firstName);
  }, [saveFiles]);

  const addPackage = useCallback(() => {
    const name = pkgInput.trim();
    if (name && !packages.includes(name)) setPackages(prev => [...prev, name]);
    setPkgInput("");
  }, [pkgInput, packages]);

  const removePackage = useCallback((pkg: string) => {
    setPackages(prev => prev.filter(p => p !== pkg));
  }, []);

  const handleNameSubmit = useCallback(async (name: string) => {
    setShowNameModal(false);
    if (name && name !== "Anonymous") await setDisplayName(name);
  }, [setDisplayName]);

  const handleExport = useCallback(() => {
    const payload = { sessionId, displayName, provider, milestone, activeModuleIndex, files, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `session-${sessionId?.slice(0, 8) ?? "export"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [sessionId, displayName, provider, milestone, activeModuleIndex, files]);

  const handleShare = useCallback(() => {
    if (!sessionId) return;
    const url = `${window.location.origin}/share/${sessionId}`;
    navigator.clipboard.writeText(url).catch(console.error);
    alert(`Share link copied!\n\n${url}`);
  }, [sessionId]);

  const codeContext = files.map(f => `# === ${f.name} ===\n${f.content}`).join("\n\n");
  const currentModuleId = MODULE_IDS[activeModuleIndex] ?? MODULE_IDS[0];

  return (
    <div className="fixed inset-0 flex flex-col" style={{ background: "var(--background)" }}>
      <div className="aether-bg" />
      <div className="blueprint-grid" />

      <DisplayNameModal open={showNameModal} onSubmit={handleNameSubmit} />

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="h-14 shrink-0 flex items-center justify-between px-6 border-b border-white/[0.07] bg-white/[0.02] backdrop-blur-xl z-50">
        {/* Left: branding */}
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
              <Code2 size={16} className="text-white" />
            </div>
            <div>
              <div className="text-sm font-bold text-white/90 leading-none">Socratic Studio</div>
              <div className="text-[10px] text-white/30 leading-none mt-0.5">AI Learning Platform</div>
            </div>
          </div>

          <div className="h-5 w-px bg-white/[0.08]" />

          <AnimatePresence mode="wait">
            <motion.div
              key={milestone}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              className="flex items-center gap-2 px-3 py-1 bg-indigo-500/[0.08] border border-indigo-500/[0.15] rounded-lg"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
              <span className="text-xs font-semibold text-indigo-200/70">{milestone}</span>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Right: controls */}
        <div className="flex items-center gap-2.5">
          {displayName && (
            <button onClick={() => setShowNameModal(true)} className="flex items-center gap-1.5 text-white/40 hover:text-white/70 transition-colors px-2 py-1 rounded-lg hover:bg-white/[0.04]">
              <User size={13} />
              <span className="text-xs font-medium">{displayName}</span>
            </button>
          )}

          <SnapshotPanel sessionId={sessionId} currentFiles={files} onRestore={handleRestoreSnapshot} />

          <button onClick={handleExport} className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-white/35 hover:text-white/65 border border-white/[0.07] hover:border-white/[0.14] rounded-lg transition-all">
            <Download size={13} />
            Export
          </button>

          <button onClick={handleShare} className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-indigo-300/60 hover:text-indigo-200 border border-indigo-500/[0.15] hover:border-indigo-500/30 rounded-lg transition-all">
            <Share2 size={13} />
            Share
          </button>

          <div className="h-5 w-px bg-white/[0.08]" />

          {/* Provider toggle */}
          <div className="flex items-center bg-black/40 rounded-xl border border-white/[0.07] p-0.5">
            <button
              onClick={() => handleProviderChange("openai")}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-[10px] text-xs font-semibold transition-all ${provider === "openai" ? "bg-white text-black shadow-lg" : "text-white/30 hover:text-white/55"}`}
            >
              <Globe size={12} />
              OpenAI
            </button>
            <button
              onClick={() => handleProviderChange("ollama")}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-[10px] text-xs font-semibold transition-all ${provider === "ollama" ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/30" : "text-white/30 hover:text-white/55"}`}
            >
              <Cpu size={12} />
              Ollama
            </button>
          </div>
        </div>
      </header>

      {/* ── Main 3-column layout ────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 flex overflow-hidden">

        {/* Column 1: Curriculum sidebar */}
        <aside className="w-60 shrink-0 border-r border-white/[0.07] bg-black/20 flex flex-col overflow-hidden">
          <CurriculumPanel
            activeModuleIndex={activeModuleIndex}
            onSelectModule={handleSelectModule}
            onLoadStarterCode={handleLoadStarterCode}
          />
        </aside>

        {/* Column 2: Chat (the learning hero) */}
        <div className="flex-1 min-w-0 flex flex-col border-r border-white/[0.07]">
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
        </div>

        {/* Column 3: Code Workshop (collapsible) */}
        <AnimatePresence initial={false}>
          {showCodePanel && (
            <motion.aside
              key="code-panel"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: "42%", opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
              className="shrink-0 flex flex-col overflow-hidden bg-[#090b15]"
              style={{ minWidth: 0 }}
            >
              {/* Workshop toolbar */}
              <div className="h-11 shrink-0 flex items-center justify-between px-4 border-b border-white/[0.07] bg-white/[0.02]">
                <span className="text-[11px] font-bold uppercase tracking-widest text-white/25">Code Workshop</span>
                <div className="flex items-center gap-1.5">
                  {/* Packages popover */}
                  <div className="relative">
                    <button
                      onClick={() => setShowPkgPopover(p => !p)}
                      title="Pip packages"
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all border ${
                        packages.length > 0
                          ? "bg-amber-500/10 border-amber-500/25 text-amber-400"
                          : "bg-white/[0.04] border-white/[0.07] text-white/30 hover:text-white/55"
                      }`}
                    >
                      <Package size={11} />
                      {packages.length > 0 ? `${packages.length} pkg` : "Pkgs"}
                    </button>

                    <AnimatePresence>
                      {showPkgPopover && (
                        <motion.div
                          initial={{ opacity: 0, y: -4, scale: 0.97 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -4, scale: 0.97 }}
                          transition={{ duration: 0.12 }}
                          className="absolute top-full right-0 mt-1 w-60 bg-[#0d0f1c] border border-white/10 rounded-xl shadow-2xl shadow-black/60 z-50 p-3 flex flex-col gap-2.5"
                        >
                          <div className="text-[10px] font-bold uppercase tracking-widest text-white/30">Pip Packages</div>
                          <div className="flex gap-2">
                            <input
                              autoFocus
                              value={pkgInput}
                              onChange={e => setPkgInput(e.target.value)}
                              onKeyDown={e => { if (e.key === "Enter") addPackage(); if (e.key === "Escape") setShowPkgPopover(false); }}
                              placeholder="e.g. requests"
                              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-amber-500/40 font-mono"
                            />
                            <button onClick={addPackage} className="px-2 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 rounded-lg">
                              <Plus size={13} />
                            </button>
                          </div>
                          {packages.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {packages.map(pkg => (
                                <span key={pkg} className="flex items-center gap-1 px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded-full text-xs text-amber-300/80 font-mono">
                                  {pkg}
                                  <button onClick={() => removePackage(pkg)} className="text-amber-400/50 hover:text-rose-400">
                                    <X size={9} />
                                  </button>
                                </span>
                              ))}
                            </div>
                          )}
                          <p className="text-[10px] text-white/20 italic">Installed before each run.</p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Run Tests */}
                  <button
                    onClick={() => { setExecMode("test"); setExecutionCount(c => c + 1); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950 text-emerald-400 border border-emerald-500/20 text-xs font-semibold hover:bg-emerald-900 transition-all active:scale-[0.96]"
                  >
                    <FlaskConical size={12} />
                    Tests
                  </button>

                  {/* Run */}
                  <button
                    onClick={() => { setExecMode("run"); setExecutionCount(c => c + 1); }}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all active:scale-[0.96] shadow-lg shadow-indigo-500/20"
                  >
                    <PlayCircle size={13} />
                    Run
                  </button>
                </div>
              </div>

              {/* Editor + Terminal */}
              <div className="flex-1 min-h-0">
                <PanelGroup orientation="vertical">
                  <Panel defaultSize={63} minSize={30} className="flex flex-col">
                    <Editor
                      files={files}
                      activeFileName={activeFileName}
                      onFileChange={updateFileContent}
                      onActiveChange={handleActiveChange}
                      onAddFile={addFile}
                      onRemoveFile={removeFile}
                    />
                  </Panel>

                  <PanelResizeHandle className="h-3 group flex items-center justify-center">
                    <div className="h-px w-16 bg-white/[0.06] group-hover:bg-indigo-500/40 transition-colors rounded-full" />
                  </PanelResizeHandle>

                  <Panel defaultSize={37} minSize={15} className="bg-black/50">
                    <Terminal
                      files={files}
                      executionCount={executionCount}
                      packages={packages.length > 0 ? packages : undefined}
                      mode={execMode}
                    />
                  </Panel>
                </PanelGroup>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Toggle tab */}
        <button
          onClick={() => setShowCodePanel(p => !p)}
          title={showCodePanel ? "Hide workshop" : "Open code workshop"}
          className="w-8 shrink-0 flex flex-col items-center justify-center gap-2.5 border-l border-white/[0.07] bg-black/20 hover:bg-white/[0.04] transition-colors group"
        >
          {showCodePanel ? (
            <ChevronRight size={14} className="text-white/25 group-hover:text-white/50 transition-colors" />
          ) : (
            <ChevronLeft size={14} className="text-white/25 group-hover:text-white/50 transition-colors" />
          )}
          <span className="text-[9px] font-bold uppercase tracking-widest text-white/15 group-hover:text-white/35 transition-colors" style={{ writingMode: "vertical-lr", rotate: "180deg" }}>
            Workshop
          </span>
        </button>
      </div>
    </div>
  );
}
